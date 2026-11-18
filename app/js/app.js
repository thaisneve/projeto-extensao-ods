/* Carbono e riqueza – lógica da aplicação
   Abre o banco SQLite (data/projeto_ods.sqlite) no navegador com sql.js,
   executa as consultas SQL e desenha os gráficos com Chart.js.
   Regra de segurança: nenhum valor vindo da tela entra no texto do SQL.
   Os filtros são conferidos contra listas fechadas e passados como parâmetros. */
"use strict";

const COR = { verde: "#0e7a5a", cinza: "#a3adb0", grafite: "#1f2b30", grafite2: "#4a575c", laranja: "#c8411b", grade: "#dfe4e2" };
const fmt = (v, d = 1) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 1) => fmt(v, d) + "%";
const var_ = (v, d = 1) => (v > 0 ? "+" : "") + fmt(v, d) + "%";
let db;

Chart.defaults.font.family = '"Archivo", "Segoe UI", Arial, sans-serif';
Chart.defaults.font.size = 13;
Chart.defaults.color = "#4a575c";
Chart.defaults.plugins.legend.display = false;
Chart.defaults.animation.duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500;
Chart.defaults.locale = "pt-BR";

/* Rótulos diretos nos gráficos, no lugar de legendas (storytelling com dados) */
const rotulos = {
  id: "rotulos",
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || !opts.itens) return;
    const { ctx } = chart;
    ctx.save();
    opts.itens.forEach(it => {
      const el = chart.getDatasetMeta(it.ds ?? 0).data[it.i];
      if (!el) return;
      ctx.font = `${it.peso || 600} 13px Archivo, Arial, sans-serif`;
      ctx.fillStyle = it.cor || COR.grafite;
      ctx.textAlign = it.align || "left";
      ctx.textBaseline = "middle";
      ctx.fillText(it.texto, el.x + (it.dx ?? 8), el.y + (it.dy ?? -10));
    });
    ctx.restore();
  }
};
Chart.register(rotulos);
const eixo = (titulo, extra = {}) => ({ grid: { color: COR.grade }, border: { display: false }, title: { display: !!titulo, text: titulo }, ...extra });

/* Executa uma consulta com parâmetros vinculados (sem concatenar valores no SQL) */
function q(sql, params = []) {
  const st = db.prepare(sql);
  st.bind(params);
  const out = [];
  while (st.step()) out.push(st.getAsObject());
  st.free();
  return out;
}
const limpa = sql => sql.trim().replace(/^ {2,}/gm, "  ");
const mostraSQL = (id, ...sqls) => { document.getElementById(id).textContent = sqls.map(limpa).join("\n\n"); };
const preenche = (k, v) => document.querySelectorAll(`[data-k="${k}"]`).forEach(el => { el.textContent = v; });
const kpis = (id, itens) => {
  document.getElementById(id).innerHTML = itens.map(([rot, val, cls]) =>
    `<div${cls ? ` class="${cls}"` : ""}><dt>${rot}</dt><dd>${val}</dd></div>`).join("");
};
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

/* ======================= Abertura e Brasil ======================= */
const SQL_BR = `
SELECT ano, co2_mt, co2_por_pib, pib / 1e12 AS pib_tri, participacao_mundial
FROM emissao
WHERE iso_code = 'BRA'
ORDER BY ano;`;
const SQL_DESC = `
-- Média, variância amostral (n - 1), mínimo e máximo das emissões do Brasil
SELECT COUNT(*) AS n, AVG(co2_mt) AS media,
       (SUM(co2_mt * co2_mt) - SUM(co2_mt) * SUM(co2_mt) / COUNT(*)) / (COUNT(*) - 1) AS variancia,
       MIN(co2_mt) AS minimo, MAX(co2_mt) AS maximo
FROM emissao WHERE iso_code = 'BRA';`;

function abertura(br) {
  const ini = br[0], fim = br[br.length - 1];
  const idx = (r, campo) => r[campo] / ini[campo] * 100;
  const anos = br.map(r => r.ano), n = anos.length - 1;
  const varPib = idx(fim, "pib_tri") - 100, varCo2 = idx(fim, "co2_mt") - 100, varInt = idx(fim, "co2_por_pib") - 100;
  document.getElementById("h-pib").textContent = pct(varPib);
  document.getElementById("h-co2").textContent = pct(varCo2);
  document.getElementById("h-int").textContent = pct(-varInt);
  new Chart("g-abertura", {
    type: "line",
    data: { labels: anos, datasets: [
      { data: br.map(r => idx(r, "pib_tri")), borderColor: COR.grafite, borderWidth: 3, pointRadius: 0, tension: .2 },
      { data: br.map(r => idx(r, "co2_mt")), borderColor: COR.laranja, borderWidth: 3, pointRadius: 0, tension: .2 },
      { data: br.map(r => idx(r, "co2_por_pib")), borderColor: COR.verde, borderWidth: 4, pointRadius: 0, tension: .2 },
    ] },
    options: {
      maintainAspectRatio: false, responsive: true, layout: { padding: { right: 150 } },
      scales: { x: eixo("", { ticks: { maxTicksLimit: 9 }, grid: { display: false } }), y: eixo("", { min: 60, ticks: { maxTicksLimit: 6 } }) },
      plugins: {
        tooltip: { callbacks: { label: c => `${["PIB", "Emissões de CO₂", "CO₂ por dólar"][c.datasetIndex]}: ${fmt(c.parsed.y, 0)}` } },
        rotulos: { itens: [
          { ds: 0, i: n, texto: `PIB ${var_(varPib)}`, dy: 0, cor: COR.grafite, peso: 800 },
          { ds: 1, i: n, texto: `Emissões ${var_(varCo2)}`, dy: 0, cor: COR.laranja, peso: 800 },
          { ds: 2, i: n, texto: `CO₂ por dólar ${var_(varInt)}`, dy: 0, cor: COR.verde, peso: 800 },
        ] }
      }
    }
  });
  return { varPib, varCo2, varInt };
}

function brasil(br, var_s) {
  const d = q(SQL_DESC)[0];
  const ini = br[0], fim = br[br.length - 1];
  const i14 = br.findIndex(r => r.ano === 2014), r14 = br[i14];
  const ord = br.map(r => r.co2_mt).sort((a, b) => a - b);
  const mediana = ord.length % 2 ? ord[(ord.length - 1) / 2] : (ord[ord.length / 2 - 1] + ord[ord.length / 2]) / 2;
  preenche("co2_90", fmt(ini.co2_mt)); preenche("co2_22", fmt(fim.co2_mt)); preenche("var_int", var_(var_s.varInt));
  kpis("kpi-br", [
    ["Média anual de emissões", fmt(d.media) + " Mt", "br"],
    ["Mediana das emissões", fmt(mediana) + " Mt"],
    ["Desvio padrão", fmt(Math.sqrt(d.variancia)) + " Mt"],
    ["Pico das emissões (2014)", fmt(d.maximo) + " Mt"],
  ]);
  mostraSQL("sql-brasil", SQL_BR, SQL_DESC);
  const anos = br.map(r => r.ano);
  const marca = (cor) => anos.map((_, i) => (i === i14 ? 5 : 0));
  new Chart("g-co2", {
    type: "line",
    data: { labels: anos, datasets: [{ data: br.map(r => r.co2_mt), borderColor: COR.grafite, borderWidth: 2.5, pointRadius: marca(), pointBackgroundColor: COR.laranja, pointBorderColor: COR.laranja, tension: .2 }] },
    options: { scales: { x: eixo("", { ticks: { maxTicksLimit: 6 }, grid: { display: false } }), y: eixo("") },
      plugins: { tooltip: { callbacks: { label: c => fmt(c.parsed.y) + " Mt" } },
        rotulos: { itens: [{ i: i14, texto: `2014: ${fmt(r14.co2_mt)} Mt (pico)`, align: "center", dx: 0, dy: -16, cor: COR.laranja }] } } }
  });
  new Chart("g-int", {
    type: "line",
    data: { labels: anos, datasets: [{ data: br.map(r => r.co2_por_pib), borderColor: COR.verde, borderWidth: 2.5, pointRadius: marca(), pointBackgroundColor: COR.laranja, pointBorderColor: COR.laranja, tension: .2 }] },
    options: { scales: { x: eixo("", { ticks: { maxTicksLimit: 6 }, grid: { display: false } }), y: eixo("", { ticks: { callback: v => fmt(v, 3) } }) },
      plugins: { tooltip: { callbacks: { label: c => fmt(c.parsed.y, 3) + " kg por int-$" } },
        rotulos: { itens: [{ i: i14, texto: `2014: ${fmt(r14.co2_por_pib, 3)} (volta a cair)`, align: "center", dx: 0, dy: -16, cor: COR.laranja }] } } }
  });
}

function painel(br, var_s, r) {
  const v = Object.fromEntries(q("SELECT iso_code, co2_per_capita FROM emissao WHERE ano = 2022 AND iso_code IN ('BRA', 'OWID_WRL')").map(x => [x.iso_code, x.co2_per_capita]));
  const itens = [
    ["#brasil", "CO₂ por dólar de PIB desde 1990", var_(var_s.varInt), "br"],
    ["#brasil", "Emissões do Brasil em 2022", fmt(br[br.length - 1].co2_mt, 0) + " Mt"],
    ["#habitante", `CO₂ por brasileiro (mundo: ${fmt(v.OWID_WRL, 1)} t)`, fmt(v.BRA, 1) + " t", "br"],
    ["#pib", "Correlação entre PIB e CO₂", "r = " + fmt(r, 2)],
  ];
  document.getElementById("painel").innerHTML = itens.map(([href, rot, val, cls]) =>
    `<div${cls ? ` class="${cls}"` : ""}><a href="${href}"><dt>${rot}</dt><dd>${val}</dd></a></div>`).join("");
}

/* ======================= Mundo: volume ======================= */
const SQL_TOP = `
SELECT p.iso_code, p.nome_pt, e.co2_mt, e.participacao_mundial,
       RANK() OVER (ORDER BY e.co2_mt DESC) AS posicao
FROM emissao e JOIN pais p ON p.iso_code = e.iso_code
WHERE e.ano = 2022 AND p.eh_agregado = 0
ORDER BY e.co2_mt DESC
LIMIT 12;`;
const SQL_SHARE = `
SELECT ano, participacao_mundial FROM emissao
WHERE iso_code = 'BRA' ORDER BY ano;`;
const SQL_TOP10 = `
SELECT SUM(co2_mt) * 100.0 / (SELECT SUM(co2_mt) FROM emissao e JOIN pais p ON p.iso_code = e.iso_code
                              WHERE ano = 2022 AND eh_agregado = 0) AS pct_top10
FROM (SELECT co2_mt FROM emissao e JOIN pais p ON p.iso_code = e.iso_code
      WHERE ano = 2022 AND eh_agregado = 0 ORDER BY co2_mt DESC LIMIT 10);`;

function volume() {
  const top = q(SQL_TOP);
  const top10 = q(SQL_TOP10)[0].pct_top10;
  const share = q(SQL_SHARE);
  const br = top.find(r => r.iso_code === "BRA");
  const chn = top.find(r => r.iso_code === "CHN");
  const iBr = top.indexOf(br);
  preenche("rank", br.posicao + "º"); preenche("br_mt", fmt(br.co2_mt)); preenche("br_share", pct(br.participacao_mundial));
  preenche("top10", pct(top10)); preenche("chn_share", pct(chn.participacao_mundial));
  const s90 = share[0].participacao_mundial, s22 = share[share.length - 1].participacao_mundial;
  const sMax = share.reduce((a, b) => (b.participacao_mundial > a.participacao_mundial ? b : a));
  kpis("kpi-volume", [
    ["Posição do Brasil em 2022", br.posicao + "º", "br"],
    ["Participação do Brasil em 1990", pct(s90, 2)],
    [`Maior participação (${sMax.ano})`, pct(sMax.participacao_mundial, 2)],
    ["Participação dos 10 maiores", pct(top10)],
  ]);
  mostraSQL("sql-volume", SQL_TOP, SQL_TOP10, SQL_SHARE);
  new Chart("g-top", {
    type: "bar",
    data: { labels: top.map(r => r.nome_pt), datasets: [{ data: top.map(r => r.co2_mt), backgroundColor: top.map(r => (r.iso_code === "BRA" ? COR.verde : COR.cinza)), borderRadius: 3 }] },
    options: { indexAxis: "y", layout: { padding: { right: 10 } }, scales: { x: eixo(""), y: eixo("", { grid: { display: false } }) },
      plugins: { tooltip: { callbacks: { label: c => `${fmt(c.parsed.x)} Mt (${pct(top[c.dataIndex].participacao_mundial)} do mundo)` } },
        rotulos: { itens: [{ i: iBr, texto: `Brasil: ${fmt(br.co2_mt)} Mt (${pct(br.participacao_mundial)} do mundo)`, dx: 8, dy: 0, cor: COR.verde, peso: 800 }] } } }
  });
  new Chart("g-share", {
    type: "line",
    data: { labels: share.map(r => r.ano), datasets: [{ data: share.map(r => r.participacao_mundial), borderColor: COR.verde, borderWidth: 3, pointRadius: 0, tension: .2 }] },
    options: { scales: { x: eixo("", { ticks: { maxTicksLimit: 6 }, grid: { display: false } }), y: eixo("", { min: 0, ticks: { callback: v => fmt(v, 1) + "%" } }) },
      plugins: { tooltip: { callbacks: { label: c => pct(c.parsed.y, 2) + " das emissões mundiais" } },
        rotulos: { itens: [
          { i: 0, texto: pct(s90, 2), dx: 0, dy: -14, cor: COR.verde },
          { i: share.length - 1, texto: pct(s22, 2), align: "right", dx: 0, dy: -14, cor: COR.verde, peso: 800 },
        ] } } }
  });
}

/* ======================= Mundo: por habitante ======================= */
const SQL_HIST = `
SELECT CASE WHEN co2_per_capita >= 30 THEN '30 ou mais'
            ELSE (CAST(co2_per_capita / 5 AS INT) * 5) || '–' || (CAST(co2_per_capita / 5 AS INT) * 5 + 5) END AS classe,
       COUNT(*) AS fi, MIN(co2_per_capita) AS ordem
FROM emissao e JOIN pais p ON p.iso_code = e.iso_code
WHERE e.ano = 2022 AND p.eh_agregado = 0 AND co2_per_capita IS NOT NULL
GROUP BY classe ORDER BY ordem;`;
const SQL_TOPPC = `
SELECT p.iso_code, p.nome_pt, e.co2_per_capita
FROM emissao e JOIN pais p ON p.iso_code = e.iso_code
WHERE e.ano = 2022 AND p.eh_agregado = 0 AND e.populacao >= 1000000
ORDER BY e.co2_per_capita DESC
LIMIT 10;`;
const SQL_CTX = `
SELECT iso_code, co2_per_capita, renovaveis_eletr FROM emissao
WHERE ano = 2022 AND iso_code IN ('BRA', 'OWID_WRL');`;
const SQL_PC = `
SELECT co2_per_capita FROM emissao e JOIN pais p ON p.iso_code = e.iso_code
WHERE e.ano = 2022 AND p.eh_agregado = 0 AND co2_per_capita IS NOT NULL
ORDER BY co2_per_capita;`;

function habitante() {
  const ctx = Object.fromEntries(q(SQL_CTX).map(r => [r.iso_code, r]));
  const pc = q(SQL_PC).map(r => r.co2_per_capita);
  const n = pc.length, soma = pc.reduce((a, b) => a + b, 0), media = soma / n;
  const mediana = n % 2 ? pc[(n - 1) / 2] : (pc[n / 2 - 1] + pc[n / 2]) / 2;
  const gini = (2 * pc.reduce((s, v, i) => s + (i + 1) * v, 0)) / (n * soma) - (n + 1) / n;
  const abaixo5 = pc.filter(v => v < 5).length;
  preenche("br_pc", fmt(ctx.BRA.co2_per_capita, 2)); preenche("mundo_pc", fmt(ctx.OWID_WRL.co2_per_capita, 2));
  preenche("renov", pct(ctx.BRA.renovaveis_eletr)); preenche("renov_mundo", pct(ctx.OWID_WRL.renovaveis_eletr));
  kpis("kpi-hab", [
    ["Média entre os países", fmt(media, 2) + " t"],
    ["Mediana entre os países", fmt(mediana, 2) + " t"],
    ["Países abaixo de 5 t", `${abaixo5} de ${n}`],
    ["Índice de Gini (0 a 1)", fmt(gini, 2)],
  ]);
  mostraSQL("sql-hab", SQL_HIST, SQL_TOPPC, SQL_CTX, SQL_PC);
  const hist = q(SQL_HIST);
  new Chart("g-hist", {
    type: "bar",
    data: { labels: hist.map(r => r.classe), datasets: [{ data: hist.map(r => r.fi), backgroundColor: hist.map((_, i) => (i === 0 ? COR.verde : COR.cinza)), borderRadius: 3, barPercentage: .95, categoryPercentage: .95 }] },
    options: { scales: { x: eixo("t de CO₂ por habitante", { grid: { display: false } }), y: eixo("países") },
      plugins: { tooltip: { callbacks: { label: c => `${c.parsed.y} países` } },
        rotulos: { itens: [{ i: 0, texto: `${hist[0].fi} países, incluindo o Brasil`, dx: 30, dy: 18, cor: COR.verde }] } } }
  });
  const top = q(SQL_TOPPC);
  const linhas = [...top, { iso_code: "OWID_WRL", nome_pt: "Média mundial", co2_per_capita: ctx.OWID_WRL.co2_per_capita }, { iso_code: "BRA", nome_pt: "Brasil", co2_per_capita: ctx.BRA.co2_per_capita }];
  new Chart("g-toppc", {
    type: "bar",
    data: { labels: linhas.map(r => r.nome_pt), datasets: [{ data: linhas.map(r => r.co2_per_capita),
      backgroundColor: linhas.map(r => (r.iso_code === "BRA" ? COR.verde : r.iso_code === "OWID_WRL" ? COR.grafite : COR.cinza)), borderRadius: 3 }] },
    options: { indexAxis: "y", scales: { x: eixo(""), y: eixo("", { grid: { display: false } }) },
      plugins: { tooltip: { callbacks: { label: c => fmt(c.parsed.x, 2) + " t por habitante" } },
        rotulos: { itens: [
          { i: linhas.length - 2, texto: fmt(ctx.OWID_WRL.co2_per_capita, 2) + " t", dx: 8, dy: 0, cor: COR.grafite, peso: 800 },
          { i: linhas.length - 1, texto: fmt(ctx.BRA.co2_per_capita, 2) + " t", dx: 8, dy: 0, cor: COR.verde, peso: 800 },
        ] } } }
  });
}

/* ======================= PIB e CO2: regressão e simulador ======================= */
const SQL_REG = `
-- Somatórios para a regressão linear simples (Y = CO2 em Mt, X = PIB em trilhões de int-$)
SELECT COUNT(*) AS n,
       SUM(pib / 1e12) AS sx, SUM(co2_mt) AS sy,
       SUM((pib / 1e12) * (pib / 1e12)) AS sxx, SUM(co2_mt * co2_mt) AS syy,
       SUM((pib / 1e12) * co2_mt) AS sxy
FROM emissao WHERE iso_code = 'BRA';
-- a = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²);  b = ȳ − a·x̄
-- r = (n·Σxy − Σx·Σy) / √[(n·Σx² − (Σx)²)(n·Σy² − (Σy)²)]`;

function pib(br) {
  const s = q(SQL_REG)[0];
  const num = s.n * s.sxy - s.sx * s.sy;
  const a = num / (s.n * s.sxx - s.sx ** 2);
  const b = s.sy / s.n - a * s.sx / s.n;
  const r = num / Math.sqrt((s.n * s.sxx - s.sx ** 2) * (s.n * s.syy - s.sy ** 2));
  preenche("eq", `ŷ = ${fmt(a, 2)}x + ${fmt(b, 2)}`); preenche("r", fmt(r, 3)); preenche("a", fmt(a));
  mostraSQL("sql-pib", SQL_REG);
  const pontos = br.map(p => ({ x: p.pib_tri, y: p.co2_mt, ano: p.ano }));
  const xs = [Math.min(...pontos.map(p => p.x)) - .05, Math.max(...pontos.map(p => p.x)) + .05];
  const marcados = [1990, 2000, 2014, 2022];
  new Chart("g-reg", {
    type: "scatter",
    data: { datasets: [
      { data: pontos, backgroundColor: pontos.map(p => (p.ano > 2014 ? COR.verde : COR.grafite)), pointRadius: 5 },
      { type: "line", data: xs.map(x => ({ x, y: a * x + b })), borderColor: COR.laranja, borderWidth: 2, pointRadius: 0 },
    ] },
    options: {
      scales: { x: eixo("PIB (trilhões de int-$ de 2011)", { ticks: { callback: v => fmt(v, 1) } }), y: eixo("CO₂ (Mt)") },
      plugins: { tooltip: { callbacks: { label: c => (c.datasetIndex ? "reta de regressão" : `${c.raw.ano}: ${fmt(c.raw.y)} Mt`) } },
        rotulos: { itens: pontos.map((p, i) => ({ p, i })).filter(o => marcados.includes(o.p.ano))
          .map(o => ({ i: o.i, texto: String(o.p.ano), dx: 10, dy: o.p.ano === 2022 ? 16 : -10, cor: o.p.ano > 2014 ? COR.verde : COR.grafite })) } } }
  });
  const fim = br[br.length - 1];
  const intens22 = fim.co2_mt / fim.pib_tri;
  const ePib = document.getElementById("sim-pib"), eRed = document.getElementById("sim-red");
  const atualiza = () => {
    const x = parseFloat(ePib.value), red = parseFloat(eRed.value) / 100;
    const yReg = a * x + b, ySim = intens22 * (1 - red) * x;
    const necessario = Math.max(0, (1 - fim.co2_mt / (intens22 * x)) * 100);
    document.getElementById("sim-pib-out").textContent = fmt(x, 1);
    document.getElementById("sim-red-out").textContent = fmt(red * 100, 0);
    document.getElementById("sim-reg").textContent = fmt(yReg, 0) + " Mt";
    document.getElementById("sim-int").textContent = fmt(ySim, 0) + " Mt";
    document.getElementById("sim-base").textContent = fmt(fim.co2_mt, 0) + " Mt";
    document.getElementById("sim-dif").textContent =
      `Para o PIB chegar a ${fmt(x, 1)} trilhões sem emitir mais que em 2022, a intensidade de carbono precisa cair pelo menos ${fmt(necessario, 0)}%. ` +
      (ySim <= fim.co2_mt ? "Com a redução escolhida, isso acontece." : "Com a redução escolhida, as emissões ainda ficam acima de 2022.") +
      " Estimativa simples: PIB × intensidade, sem prever mudanças de tecnologia ou de matriz energética.";
  };
  ePib.addEventListener("input", atualiza);
  eRed.addEventListener("input", atualiza);
  atualiza();
  return r;
}

/* ======================= Índice de alerta ======================= */
const SQL_ALERTA_TOP = `
SELECT posicao_alerta, nome_pt, indice_alerta, nivel_alerta
FROM indice_alerta
ORDER BY posicao_alerta
LIMIT 15;`;
const SQL_ALERTA_NIVEIS = `
SELECT nivel_alerta, COUNT(*) AS paises
FROM indice_alerta GROUP BY nivel_alerta;`;
const SQL_ALERTA_BR = `
SELECT posicao_alerta, (SELECT COUNT(*) FROM indice_alerta) AS total,
       indice_alerta, nivel_alerta, variacao_10anos_pct, dependencia_petroleo_pct,
       nota_tendencia, nota_per_capita, nota_intensidade, nota_petroleo,
       co2_2022, projecao_co2_2030
FROM indice_alerta WHERE iso_code = 'BRA';`;
const SQL_PROJ = `
SELECT nome_pt, co2_2022, projecao_co2_2030,
       projecao_co2_2030 - co2_2022 AS aumento_previsto_mt
FROM indice_alerta
ORDER BY aumento_previsto_mt DESC
LIMIT 8;`;

function alerta() {
  const niv = Object.fromEntries(q(SQL_ALERTA_NIVEIS).map(r => [r.nivel_alerta, r.paises]));
  const br = q(SQL_ALERTA_BR)[0];
  const top = q(SQL_ALERTA_TOP);
  preenche("n_alerta", String(br.total));
  preenche("br_pet", pct(br.dependencia_petroleo_pct));
  kpis("kpi-alerta", [
    ["Países em alerta alto", String(niv.Alto || 0), "alto"],
    ["Países em alerta moderado", String(niv.Moderado || 0)],
    ["Países em alerta baixo", String(niv.Baixo || 0)],
    [`Brasil (${br.nivel_alerta.toLowerCase()})`, `${fmt(br.indice_alerta, 1)}, ${br.posicao_alerta}º de ${br.total}`, "br"],
  ]);
  new Chart("g-alerta", {
    type: "bar",
    data: { labels: top.map(r => r.nome_pt), datasets: [{ data: top.map(r => r.indice_alerta), backgroundColor: top.map(r => (r.nivel_alerta === "Alto" ? COR.laranja : COR.grafite2)), borderRadius: 3 }] },
    options: { indexAxis: "y", scales: { x: eixo("", { min: 0, max: 100 }), y: eixo("", { grid: { display: false } }) },
      plugins: { tooltip: { callbacks: { label: c => `Índice ${fmt(c.parsed.x, 1)} (${top[c.dataIndex].nivel_alerta.toLowerCase()})` } } } }
  });
  const sinais = [
    ["Emissões crescendo (35%)", br.nota_tendencia],
    ["CO₂ por habitante (25%)", br.nota_per_capita],
    ["Intensidade de carbono (25%)", br.nota_intensidade],
    ["Dependência de petróleo (15%)", br.nota_petroleo],
  ];
  new Chart("g-alerta-br", {
    type: "bar",
    data: { labels: sinais.map(s => s[0]), datasets: [{ data: sinais.map(s => s[1]), backgroundColor: sinais.map(s => (s[1] >= 60 ? COR.laranja : COR.verde)), borderRadius: 3 }] },
    options: { indexAxis: "y", scales: { x: eixo("", { min: 0, max: 100 }), y: eixo("", { grid: { display: false } }) },
      plugins: { tooltip: { callbacks: { label: c => `Nota ${fmt(c.parsed.x, 1)}` } },
        rotulos: { itens: sinais.map((s, i) => ({ i, texto: fmt(s[1], 1), dx: 8, dy: 0, cor: s[1] >= 60 ? COR.laranja : COR.verde, peso: 800 })) } } }
  });
  const queda = br.projecao_co2_2030 < br.co2_2022;
  document.getElementById("txt-alerta-br").textContent =
    `O Brasil tem índice ${fmt(br.indice_alerta, 1)}, nível ${br.nivel_alerta.toLowerCase()}, e ocupa a ${br.posicao_alerta}ª posição entre ${br.total} países, ` +
    `ou seja, está entre os que menos preocupam. As emissões caíram ${fmt(Math.abs(br.variacao_10anos_pct), 1)}% em dez anos e a intensidade de carbono é das mais baixas. ` +
    `O ponto fraco é a dependência de petróleo: ${pct(br.dependencia_petroleo_pct)} do CO₂ brasileiro vem da queima de derivados, principalmente no transporte, o que dá ao País nota ${fmt(br.nota_petroleo, 1)} nesse sinal. ` +
    `Pela tendência de 2012 a 2022, as emissões ${queda ? "cairiam" : "subiriam"} de ${fmt(br.co2_2022, 0)} Mt para cerca de ${fmt(br.projecao_co2_2030, 0)} Mt em 2030. ` +
    `A orientação, portanto, é concentrar esforços em transporte e combustíveis, que é onde o Brasil pode perder a vantagem que já tem.`;
  const proj = q(SQL_PROJ);
  document.getElementById("tab-projecao").innerHTML =
    `<thead><tr><th scope="col">País</th><th scope="col">CO₂ 2022 (Mt)</th><th scope="col">Projeção 2030 (Mt)</th><th scope="col">Aumento previsto (Mt)</th></tr></thead><tbody>` +
    proj.map(p => `<tr><td>${esc(p.nome_pt)}</td><td class="num">${fmt(p.co2_2022, 1)}</td><td class="num">${fmt(p.projecao_co2_2030, 1)}</td><td class="num">${var_(p.aumento_previsto_mt, 1).replace("%", "")}</td></tr>`).join("") + "</tbody>";
  mostraSQL("sql-alerta", "-- A tabela indice_alerta é criada no próprio banco por database/indice_alerta.sql", SQL_ALERTA_NIVEIS, SQL_ALERTA_TOP, SQL_ALERTA_BR, SQL_PROJ);
}

/* ======================= Comparar ======================= */
// Listas fechadas: só estes indicadores e os países carregados do banco são aceitos
const INDICADORES_EX = {
  co2_per_capita: { coluna: "co2_per_capita", unid: "t por habitante", dec: 2 },
  co2_por_pib: { coluna: "co2_por_pib", unid: "kg por int-$", dec: 3 },
  indice_1990: { coluna: "co2_mt", unid: "1990 = 100", dec: 0, indice: true },
  co2_mt: { coluna: "co2_mt", unid: "Mt", dec: 0, log: true },
};
const SQL_EX = {
  co2_per_capita: "SELECT iso_code, ano, co2_per_capita AS valor FROM emissao WHERE iso_code IN ('BRA', ?) ORDER BY iso_code, ano;",
  co2_por_pib: "SELECT iso_code, ano, co2_por_pib AS valor FROM emissao WHERE iso_code IN ('BRA', ?) ORDER BY iso_code, ano;",
  co2_mt: "SELECT iso_code, ano, co2_mt AS valor FROM emissao WHERE iso_code IN ('BRA', ?) ORDER BY iso_code, ano;",
};
let gEx, PAISES;

function comparar() {
  PAISES = new Map(q(`SELECT p.iso_code, p.nome_pt FROM pais p
                      WHERE EXISTS (SELECT 1 FROM emissao e WHERE e.iso_code = p.iso_code AND e.ano = 2022)
                      ORDER BY p.eh_agregado DESC, p.nome_pt`).map(p => [p.iso_code, p.nome_pt]));
  const sel = document.getElementById("ex-pais");
  sel.innerHTML = [...PAISES].filter(([iso]) => iso !== "BRA").map(([iso, nome]) => `<option value="${iso}">${esc(nome)}</option>`).join("");
  const params = new URLSearchParams(location.hash.replace(/^#comparar\??/, ""));
  sel.value = PAISES.has(params.get("pais")) && params.get("pais") !== "BRA" ? params.get("pais") : "OWID_WRL";
  if (INDICADORES_EX[params.get("ind")]) document.querySelector(`input[name="ex-ind"][value="${params.get("ind")}"]`).checked = true;
  let atual = {};
  const aviso = document.getElementById("ex-aviso");
  const desenha = () => {
    // validação: o país e o indicador precisam existir nas listas fechadas
    const escolhaPais = sel.value, escolhaInd = document.querySelector('input[name="ex-ind"]:checked').value;
    if (!PAISES.has(escolhaPais) || !INDICADORES_EX[escolhaInd]) { aviso.textContent = "Escolha um país e um indicador da lista."; return; }
    const iso = escolhaPais;                       // variável própria, já validada
    const nome = PAISES.get(iso);
    const cfg = INDICADORES_EX[escolhaInd];
    const sql = SQL_EX[cfg.coluna];
    document.querySelectorAll(".atalhos button").forEach(bt => bt.setAttribute("aria-pressed", String(bt.dataset.iso === iso)));
    aviso.textContent = "";
    const linhas = q(sql, [iso]);
    const anos = [...new Set(linhas.map(l => l.ano))].sort();
    const serie = c => anos.map(a => { const l = linhas.find(x => x.iso_code === c && x.ano === a); return l && l.valor != null ? l.valor : null; });
    let sBr = serie("BRA"), sOu = serie(iso);
    if (cfg.indice) {
      const base = s => s.find(v => v != null);
      const bBr = base(sBr), bOu = base(sOu);
      sBr = sBr.map(v => (v == null ? null : v / bBr * 100)); sOu = sOu.map(v => (v == null || !bOu ? null : v / bOu * 100));
    }
    atual = { anos, sBr, sOu, nome, ind: escolhaInd, iso };
    const ult = arr => arr.filter(v => v != null).slice(-1)[0];
    const pri = arr => arr.find(v => v != null);
    mostraSQL("sql-ex", `${sql}\n-- parâmetro: '${iso}' (${nome}), conferido na lista de países` + (cfg.indice ? "\n-- índice: valor do ano ÷ valor de 1990 × 100, calculado na tela" : ""));
    const vf = v => (v == null ? "sem dado" : `${fmt(v, cfg.dec)} ${cfg.unid === "1990 = 100" ? "" : cfg.unid}`.trim());
    kpis("kpi-ex", [
      ["Brasil em 2022", vf(ult(sBr)), "br"],
      [`${nome} em 2022`, vf(ult(sOu))],
      ["Brasil desde 1990", var_((ult(sBr) / pri(sBr) - 1) * 100)],
      [`${nome} desde 1990`, pri(sOu) ? var_((ult(sOu) / pri(sOu) - 1) * 100) : "sem dado"],
    ]);
    document.getElementById("ex-escala").textContent = cfg.log
      ? "Escala logarítmica: cada linha de grade multiplica o valor por 10, para que países de tamanhos muito diferentes caibam no mesmo gráfico. Para comparar o ritmo de crescimento, use “Crescimento das emissões (1990 = 100)”."
      : (cfg.indice ? "Os dois países começam em 100 em 1990. Acima de 100, as emissões cresceram; abaixo, caíram." : "");
    document.getElementById("ex-tabela").innerHTML =
      `<thead><tr><th scope="col">Ano</th><th scope="col">Brasil</th><th scope="col">${esc(nome)}</th></tr></thead><tbody>` +
      anos.map((an, i) => `<tr><th scope="row">${an}</th><td class="num">${sBr[i] == null ? "–" : fmt(sBr[i], cfg.dec)}</td><td class="num">${sOu[i] == null ? "–" : fmt(sOu[i], cfg.dec)}</td></tr>`).reverse().join("") + "</tbody>";
    const data = { labels: anos, datasets: [
      { data: sBr, borderColor: COR.verde, borderWidth: 3, pointRadius: 0, tension: .2, spanGaps: true },
      { data: sOu, borderColor: COR.grafite, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, tension: .2, spanGaps: true },
    ] };
    const opts = { layout: { padding: { right: 120 } },
      scales: { x: eixo("", { ticks: { maxTicksLimit: 9 }, grid: { display: false } }),
        y: eixo(cfg.unid, cfg.log ? { type: "logarithmic", ticks: { callback: v => ([1, 10, 100, 1000, 10000, 100000].includes(v) ? fmt(v, 0) : "") } } : { type: "linear", ticks: { callback: v => fmt(v, cfg.dec === 3 ? 2 : (cfg.dec ? 1 : 0)) } }) },
      plugins: { tooltip: { callbacks: { label: c => `${c.datasetIndex ? nome : "Brasil"}: ${fmt(c.parsed.y, cfg.dec)}` } },
        rotulos: { itens: [
          { ds: 0, i: anos.length - 1, texto: "Brasil", dx: 8, dy: 0, cor: COR.verde, peso: 800 },
          { ds: 1, i: anos.length - 1, texto: nome, dx: 8, dy: 0, cor: COR.grafite, peso: 800 },
        ] } } };
    if (gEx) gEx.destroy();
    gEx = new Chart("g-ex", { type: "line", data, options: opts });
  };
  sel.addEventListener("change", desenha);
  document.querySelectorAll('input[name="ex-ind"]').forEach(r => r.addEventListener("change", desenha));
  document.querySelectorAll(".atalhos button").forEach(bt => bt.addEventListener("click", () => { if (PAISES.has(bt.dataset.iso)) { sel.value = bt.dataset.iso; desenha(); } }));
  document.getElementById("ex-link").addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}#comparar?pais=${encodeURIComponent(atual.iso)}&ind=${encodeURIComponent(atual.ind)}`;
    try { await navigator.clipboard.writeText(url); aviso.textContent = "Link copiado. Quem abrir verá esta mesma comparação."; }
    catch { aviso.textContent = url; }
    history.replaceState(null, "", url);
  });
  document.getElementById("ex-csv").addEventListener("click", () => {
    baixarCSV(`comparacao_brasil_${atual.iso.toLowerCase()}_${atual.ind}.csv`, ["ano", "brasil", atual.iso.toLowerCase()],
      atual.anos.map((an, i) => [an, atual.sBr[i], atual.sOu[i]]));
    aviso.textContent = "Arquivo CSV baixado (separador ponto e vírgula, abre no Excel).";
  });
  desenha();
}

function baixarCSV(nome, cab, linhas) {
  const txt = [cab.join(";"), ...linhas.map(l => l.map(v => (v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : `"${String(v).replace(/"/g, '""')}"`)).join(";"))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" }));
  a.download = nome; document.body.appendChild(a); a.click(); a.remove();
}

/* ======================= Qualidade ======================= */
const SQL_PESQ = `
SELECT ROUND(AVG(separacao_residuos) * 100) AS "Separação de resíduos",
       ROUND(AVG(coleta_seletiva) * 100) AS "Coleta seletiva",
       ROUND(AVG(descarte_perigosos) * 100) AS "Descarte correto de perigosos",
       ROUND(AVG(acoes_sustentabilidade) * 100) AS "Ações de sustentabilidade",
       ROUND(AVG(visao_qualidade) * 100) AS "Visão sobre a qualidade",
       ROUND(AVG(orientacao_ambiental) * 100) AS "Orientação ambiental",
       ROUND(AVG(reaproveitamento) * 100) AS "Reaproveitamento de materiais",
       ROUND(AVG(organizacao_processos) * 100) AS "Organização dos processos",
       ROUND(AVG(controle_energia) * 100) AS "Controle do consumo de energia",
       ROUND(AVG(desperdicio_visivel) * 100) AS "Desperdício visível (item negativo)",
       ROUND(AVG(controle_agua) * 100) AS "Controle do consumo de água",
       ROUND(AVG(usa_ferramenta_qualidade) * 100) AS "Uso de ferramenta da qualidade"
FROM pesquisa_resposta;`;
const SQL_ACOES = "SELECT problema, evidencia, proposta, responsavel, prazo, custo FROM acao_melhoria ORDER BY id_acao;";
const SQL_METAS = "SELECT indicador, atual, meta, unidade FROM meta_indicador ORDER BY id_meta;";

function qualidade() {
  const p = q(SQL_PESQ)[0];
  const rot = Object.keys(p), val = Object.values(p);
  new Chart("g-pesq", {
    type: "bar",
    data: { labels: rot, datasets: [{ data: val, backgroundColor: rot.map((r, i) => (r.includes("negativo") ? COR.laranja : (val[i] < 75 ? COR.grafite : COR.cinza))), borderRadius: 3 }] },
    options: { indexAxis: "y", scales: { x: eixo("", { max: 100, ticks: { callback: v => v + "%" } }), y: eixo("", { grid: { display: false } }) },
      plugins: { tooltip: { callbacks: { label: c => c.parsed.x + "% responderam Sim" } } } }
  });
  document.getElementById("acoes").innerHTML = q(SQL_ACOES).map(a =>
    `<li><strong>${esc(a.proposta)}.</strong> Responde a: ${esc(a.problema.toLowerCase())} (${esc(a.evidencia)}).
     <span class="meta-acao">Responsável: ${esc(a.responsavel)}. Prazo: ${esc(a.prazo)}. Custo: ${esc(a.custo.toLowerCase())}.</span></li>`).join("");
  document.getElementById("metas").innerHTML = q(SQL_METAS).map(m => {
    const max = m.unidade === "%" ? 100 : (m.indicador.includes("0 a 9") ? 9 : 3);
    const d = m.unidade === "%" ? 0 : 1, suf = m.unidade === "%" ? "%" : "";
    return `<div class="meta">${esc(m.indicador)}<div class="barra" role="img" aria-label="Atual ${fmt(m.atual, d)}${suf}, meta ${fmt(m.meta, d)}${suf}">
      <span class="atual" style="width:${m.atual / max * 100}%"></span><span class="alvo" style="left:calc(${m.meta / max * 100}% - 2px)"></span></div>
      <span class="valores">Hoje ${fmt(m.atual, d)}${suf}; meta ${fmt(m.meta, d)}${suf}</span></div>`;
  }).join("");
  mostraSQL("sql-q", SQL_PESQ, SQL_ACOES, SQL_METAS);
}

/* ======================= Consultas prontas (lista fechada) ======================= */
/* A tela envia apenas um objeto de filtro, por exemplo { tipo: 'serie', pais: 'BRA', indicador: 'co2_mt', de: 1990, ate: 2022 }.
   A camada de consulta nunca usa esses valores diretamente: compara cada um com as listas permitidas,
   guarda o resultado em variáveis próprias e monta o SQL só com textos fixos e parâmetros (?). */
const COLUNAS_PERMITIDAS = {
  co2_mt: { coluna: "co2_mt", rotulo: "Emissões totais (Mt)" },
  co2_per_capita: { coluna: "co2_per_capita", rotulo: "CO₂ por habitante (t)" },
  co2_por_pib: { coluna: "co2_por_pib", rotulo: "Intensidade de carbono (kg/int-$)" },
  participacao_mundial: { coluna: "participacao_mundial", rotulo: "Participação mundial (%)" },
  renovaveis_eletr: { coluna: "renovaveis_eletr", rotulo: "Eletricidade renovável (%)" },
};
const ANOS = Array.from({ length: 33 }, (_, i) => 1990 + i);
const NIVEIS = ["Alto", "Moderado", "Baixo"];
const QUANTIDADES = [5, 10, 20];

function montarConsulta(filtro) {
  if (filtro.tipo === "serie") {
    const cfg = COLUNAS_PERMITIDAS[filtro.indicador];
    if (!cfg || !PAISES.has(filtro.pais)) return null;
    let de = ANOS.find(a => a === Number(filtro.de)), ate = ANOS.find(a => a === Number(filtro.ate));
    if (de === undefined || ate === undefined) return null;
    if (de > ate) [de, ate] = [ate, de];
    const iso = [...PAISES.keys()].find(k => k === filtro.pais);   // variável própria, vinda da lista
    return { sql: `SELECT ano, ${cfg.coluna} AS valor\nFROM emissao\nWHERE iso_code = ? AND ano BETWEEN ? AND ?\nORDER BY ano;`,
             params: [iso, de, ate], nota: `${PAISES.get(iso)}, ${cfg.rotulo}, de ${de} a ${ate}` };
  }
  if (filtro.tipo === "ranking") {
    const cfg = COLUNAS_PERMITIDAS[filtro.indicador];
    const ano = ANOS.find(a => a === Number(filtro.ano));
    const qtd = QUANTIDADES.find(n => n === Number(filtro.qtd));
    if (!cfg || ano === undefined || qtd === undefined) return null;
    return { sql: `SELECT RANK() OVER (ORDER BY e.${cfg.coluna} DESC) AS posicao, p.nome_pt AS pais, e.${cfg.coluna} AS valor\nFROM emissao e JOIN pais p ON p.iso_code = e.iso_code\nWHERE e.ano = ? AND p.eh_agregado = 0 AND e.populacao >= 1000000 AND e.${cfg.coluna} IS NOT NULL\nORDER BY valor DESC\nLIMIT ?;`,
             params: [ano, qtd], nota: `${qtd} maiores em ${cfg.rotulo}, ${ano} (países com 1 milhão de habitantes ou mais)` };
  }
  if (filtro.tipo === "alerta") {
    const nivel = NIVEIS.find(n => n === filtro.nivel);
    if (!nivel) return null;
    return { sql: "SELECT posicao_alerta, nome_pt AS pais, indice_alerta, variacao_10anos_pct, co2_per_capita,\n       co2_por_pib, dependencia_petroleo_pct, projecao_co2_2030\nFROM indice_alerta\nWHERE nivel_alerta = ?\nORDER BY posicao_alerta;",
             params: [nivel], nota: `países com alerta ${nivel.toLowerCase()}` };
  }
  if (filtro.tipo === "pesquisa") {
    return { sql: "SELECT r.id_resposta, i.ipa, i.igq, r.controle_agua, r.controle_energia,\n       r.desperdicio_visivel, r.usa_ferramenta_qualidade, r.ferramenta_citada\nFROM pesquisa_resposta r JOIN vw_indices_pesquisa i ON i.id_resposta = r.id_resposta\nORDER BY r.id_resposta;",
             params: [], nota: "respostas e índices IPA e IGQ por aprendiz" };
  }
  if (filtro.tipo === "propostas") {
    return { sql: "SELECT a.id_acao, a.problema, a.proposta, a.iso_9001, a.iso_14001, a.prazo\nFROM acao_melhoria a\nORDER BY a.id_acao;",
             params: [], nota: "propostas de melhoria" };
  }
  return null;
}

function consultas() {
  const $ = id => document.getElementById(id);
  $("c-pais").innerHTML = [...PAISES].map(([iso, nome]) => `<option value="${iso}"${iso === "BRA" ? " selected" : ""}>${esc(nome)}</option>`).join("");
  const opcoesAno = sel => ANOS.map(a => `<option value="${a}"${a === sel ? " selected" : ""}>${a}</option>`).join("");
  $("c-de").innerHTML = opcoesAno(1990); $("c-ate").innerHTML = opcoesAno(2022); $("c-ano").innerHTML = opcoesAno(2022);
  const esquema = q("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name")
    .map(t => `${t.type === "view" ? "VISÃO" : "TABELA"} ${t.name}\n` +
      q(`SELECT name, type, pk FROM pragma_table_info(?)`, [t.name]).map(c => `  ${c.name}  ${c.type || ""}${c.pk ? "  (chave primária)" : ""}`).join("\n"))
    .join("\n\n");
  $("c-esquema").textContent = esquema;
  const mostraCampos = () => document.querySelectorAll("#form-consulta .campo[data-para]").forEach(c => { c.hidden = !c.dataset.para.split(" ").includes($("c-tipo").value); });
  let ultimo = null;
  const executar = () => {
    const filtro = { tipo: $("c-tipo").value, pais: $("c-pais").value, indicador: $("c-ind").value, de: $("c-de").value, ate: $("c-ate").value, ano: $("c-ano").value, qtd: $("c-qtd").value, nivel: $("c-nivel").value };
    const info = $("c-info"), tab = $("c-resultado");
    info.classList.remove("erro"); tab.innerHTML = "";
    const consulta = montarConsulta(filtro);
    if (!consulta) { $("c-sql").textContent = ""; ultimo = null; info.classList.add("erro"); info.textContent = "Filtro inválido: escolha as opções da lista."; return; }
    const t0 = performance.now();
    const linhas = q(consulta.sql, consulta.params);
    const ms = Math.round(performance.now() - t0);
    $("c-sql").textContent = consulta.sql + (consulta.params.length ? `\n-- parâmetros: ${consulta.params.map(p => (typeof p === "string" ? `'${p}'` : p)).join(", ")}` : "");
    if (!linhas.length) { info.textContent = `Nenhuma linha encontrada (${ms} ms).`; return; }
    const cols = Object.keys(linhas[0]);
    tab.innerHTML = `<thead><tr>${cols.map(c => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>` +
      linhas.map(l => `<tr>${cols.map(c => { const v = l[c]; return typeof v === "number"
        ? `<td class="num">${Number.isInteger(v) ? v : fmt(v, Math.abs(v) < 1 ? 3 : 2)}</td>` : `<td>${v == null ? "–" : esc(v)}</td>`; }).join("")}</tr>`).join("") + "</tbody>";
    info.textContent = `${linhas.length} linha(s) em ${ms} ms: ${consulta.nota}.`;
    ultimo = { cols, linhas, tipo: filtro.tipo };
  };
  $("c-tipo").addEventListener("change", () => { mostraCampos(); executar(); });
  $("form-consulta").addEventListener("submit", e => { e.preventDefault(); executar(); });
  $("c-csv").addEventListener("click", () => { if (ultimo) baixarCSV(`consulta_${ultimo.tipo}.csv`, ultimo.cols, ultimo.linhas.map(l => ultimo.cols.map(c => l[c]))); });
  mostraCampos();
  executar();
}

/* Destaca no menu a seção que está na tela */
function marcarMenu() {
  const links = [...document.querySelectorAll(".topo nav a")];
  const obs = new IntersectionObserver(ents => ents.forEach(e => {
    if (!e.isIntersecting) return;
    const id = e.target.id === "habitante" ? "mundo" : e.target.id;
    links.forEach(l => l.setAttribute("aria-current", String(l.getAttribute("href") === "#" + id)));
  }), { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main section[id]").forEach(s => obs.observe(s));
}

/* ======================= Inicialização ======================= */
(async function iniciar() {
  const estado = document.getElementById("estado");
  try {
    const t0 = performance.now();
    const SQL = await initSqlJs({ locateFile: f => `vendor/${f}` });
    const resp = await fetch("data/projeto_ods.sqlite");
    if (!resp.ok) throw new Error(`não foi possível baixar o banco (HTTP ${resp.status})`);
    db = new SQL.Database(new Uint8Array(await resp.arrayBuffer()));
    const br = q(SQL_BR);
    const var_s = abertura(br);
    brasil(br, var_s);
    volume();
    habitante();
    const r = pib(br);
    painel(br, var_s, r);
    alerta();
    comparar();
    qualidade();
    consultas();
    estado.textContent = "";
    marcarMenu();
    if (location.hash.startsWith("#comparar?")) document.getElementById("comparar").scrollIntoView();
    document.body.dataset.carregado = Math.round(performance.now() - t0);
  } catch (e) {
    estado.textContent = `O relatório não carregou: ${e.message}. Abra a página por um servidor (GitHub Pages ou "python -m http.server" na pasta app), e não direto pelo arquivo.`;
    console.error(e);
  }
})();
