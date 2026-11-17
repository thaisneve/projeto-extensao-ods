/* Carbono e riqueza – lógica da aplicação
   Abre o banco SQLite (data/projeto_ods.sqlite) no navegador com sql.js,
   executa as consultas SQL e desenha os gráficos com Chart.js. */
"use strict";

const COR = { verde: "#0e7a5a", cinza: "#a3adb0", grafite: "#1f2b30", laranja: "#c8411b", grade: "#dfe4e2" };
const fmt = (v, d = 1) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 1) => fmt(v, d) + "%";
const var_ = (v, d = 1) => (v > 0 ? "+" : "") + fmt(v, d) + "%";
let db;

Chart.defaults.font.family = '"Archivo", "Helvetica Neue", Arial, sans-serif';
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
      const meta = chart.getDatasetMeta(it.ds ?? 0);
      const el = meta.data[it.i];
      if (!el) return;
      ctx.font = `${it.peso || 600} 13px Archivo, Arial, sans-serif`;
      ctx.fillStyle = it.cor || COR.grafite;
      ctx.textAlign = it.align || "left";
      ctx.fillText(it.texto, el.x + (it.dx ?? 8), el.y + (it.dy ?? -8));
    });
    ctx.restore();
  }
};
Chart.register(rotulos);

const eixo = (titulo, extra = {}) => ({ grid: { color: COR.grade }, border: { display: false }, title: { display: !!titulo, text: titulo }, ...extra });

function q(sql, params = []) {
  const st = db.prepare(sql);
  st.bind(params);
  const out = [];
  while (st.step()) out.push(st.getAsObject());
  st.free();
  return out;
}
const mostraSQL = (id, sql) => { document.getElementById(id).textContent = sql.trim().replace(/^ {2,}/gm, "  "); };
const preenche = (k, v) => document.querySelectorAll(`[data-k="${k}"]`).forEach(el => { el.textContent = v; });

function kpis(id, itens) {
  document.getElementById(id).innerHTML = itens.map(([rot, val, br]) =>
    `<div${br ? ' class="br"' : ""}><dt>${rot}</dt><dd>${val}</dd></div>`).join("");
}

/* ---------- Capítulo 1: série do Brasil ---------- */
const SQL_BR = `
SELECT ano, co2_mt, co2_por_pib, pib / 1e12 AS pib_tri
FROM emissao
WHERE iso_code = 'BRA'
ORDER BY ano;`;
const SQL_DESC = `
-- Média, desvio padrão amostral (n - 1), mínimo e máximo das emissões
SELECT COUNT(*) AS n, AVG(co2_mt) AS media,
       (SUM(co2_mt * co2_mt) - SUM(co2_mt) * SUM(co2_mt) / COUNT(*)) / (COUNT(*) - 1) AS variancia,
       MIN(co2_mt) AS minimo, MAX(co2_mt) AS maximo
FROM emissao WHERE iso_code = 'BRA';`;

function capitulo1() {
  const br = q(SQL_BR);
  const d = q(SQL_DESC)[0];
  const ini = br[0], fim = br[br.length - 1];
  const pico = br.reduce((a, b) => (b.co2_mt > a.co2_mt ? b : a));
  const varCo2 = (fim.co2_mt / ini.co2_mt - 1) * 100;
  const varPib = (fim.pib_tri / ini.pib_tri - 1) * 100;
  const varInt = (fim.co2_por_pib / ini.co2_por_pib - 1) * 100;
  const ord = br.map(r => r.co2_mt).sort((a, b) => a - b);
  const mediana = ord.length % 2 ? ord[(ord.length - 1) / 2] : (ord[ord.length / 2 - 1] + ord[ord.length / 2]) / 2;

  document.getElementById("h-pib").textContent = pct(varPib);
  document.getElementById("h-co2").textContent = pct(varCo2);
  document.getElementById("h-int").textContent = pct(-varInt);
  preenche("co2_90", fmt(ini.co2_mt)); preenche("var_int", var_(varInt)); preenche("co2_22", fmt(fim.co2_mt));

  kpis("kpi-br", [
    ["Média anual de emissões", fmt(d.media) + " Mt", true],
    ["Mediana", fmt(mediana) + " Mt"],
    ["Desvio padrão", fmt(Math.sqrt(d.variancia)) + " Mt"],
    [`Pico (${pico.ano})`, `${fmt(pico.co2_mt)} Mt`],
  ]);
  mostraSQL("sql-cap1", SQL_BR + "\n" + SQL_DESC);

  const anos = br.map(r => r.ano);
  const iPico = br.indexOf(pico);
  new Chart("g-abertura", {
    type: "line",
    data: { labels: anos, datasets: [{ data: br.map(r => r.co2_por_pib), borderColor: COR.verde, borderWidth: 4, pointRadius: 0, tension: .25 }] },
    options: {
      maintainAspectRatio: false, responsive: true,
      scales: { x: eixo("", { ticks: { maxTicksLimit: 9 }, grid: { display: false } }), y: eixo("", { ticks: { callback: v => fmt(v, 3), maxTicksLimit: 5 } }) },
      plugins: { tooltip: { callbacks: { label: c => `${fmt(c.parsed.y, 3)} kg por int-$` } },
        rotulos: { itens: [
          { i: 0, texto: fmt(ini.co2_por_pib, 3), dy: 22, dx: 4 },
          { i: anos.length - 1, texto: fmt(fim.co2_por_pib, 3), align: "right", dx: 0, dy: 20, cor: COR.verde, peso: 800 },
        ] } }
    }
  });
  new Chart("g-co2", {
    type: "line",
    data: { labels: anos, datasets: [{ data: br.map(r => r.co2_mt), borderColor: COR.grafite, borderWidth: 2.5, pointRadius: anos.map((_, i) => (i === iPico ? 5 : 0)), pointBackgroundColor: COR.laranja, tension: .2 }] },
    options: { scales: { x: eixo("", { ticks: { maxTicksLimit: 6 }, grid: { display: false } }), y: eixo("") },
      plugins: { tooltip: { callbacks: { label: c => fmt(c.parsed.y) + " Mt" } },
        rotulos: { itens: [{ i: iPico, texto: `pico de ${pico.ano}`, align: "center", dx: 0, dy: -12, cor: COR.laranja }] } } }
  });
  new Chart("g-int", {
    type: "line",
    data: { labels: anos, datasets: [{ data: br.map(r => r.co2_por_pib), borderColor: COR.verde, borderWidth: 2.5, pointRadius: 0, tension: .2 }] },
    options: { scales: { x: eixo("", { ticks: { maxTicksLimit: 6 }, grid: { display: false } }), y: eixo("", { ticks: { callback: v => fmt(v, 3) } }) },
      plugins: { tooltip: { callbacks: { label: c => fmt(c.parsed.y, 3) + " kg por int-$" } },
        rotulos: { itens: [] } } }
  });
  return br;
}

/* ---------- Painel-resumo ---------- */
function painel(br) {
  const ini = br[0], fim = br[br.length - 1];
  const pc = q("SELECT iso_code, co2_per_capita FROM emissao WHERE ano = 2022 AND iso_code IN ('BRA','OWID_WRL')");
  const v = Object.fromEntries(pc.map(r => [r.iso_code, r.co2_per_capita]));
  const itens = [
    ["#cap1", "Intensidade de carbono desde 1990", var_((fim.co2_por_pib / ini.co2_por_pib - 1) * 100), true],
    ["#cap1", "Emissões do Brasil em 2022", fmt(fim.co2_mt, 0) + " Mt"],
    ["#cap2", "CO₂ por brasileiro (mundo: " + fmt(v.OWID_WRL, 1) + " t)", fmt(v.BRA, 1) + " t", true],
    ["#cap3", "Correlação entre PIB e CO₂", ""],
  ];
  return itens;
}

/* ---------- Capítulo 2: Brasil no mundo ---------- */
const SQL_TOP = `
SELECT p.nome_pt, e.co2_mt, e.participacao_mundial
FROM emissao e JOIN pais p ON p.iso_code = e.iso_code
WHERE e.ano = 2022 AND p.eh_agregado = 0
ORDER BY e.co2_mt DESC
LIMIT 12;`;
const SQL_HIST = `
SELECT CASE WHEN co2_per_capita >= 30 THEN '30 ou mais'
            ELSE (CAST(co2_per_capita / 5 AS INT) * 5) || '–' || (CAST(co2_per_capita / 5 AS INT) * 5 + 5) END AS classe,
       COUNT(*) AS fi, MIN(co2_per_capita) AS ordem
FROM emissao e JOIN pais p ON p.iso_code = e.iso_code
WHERE e.ano = 2022 AND p.eh_agregado = 0 AND co2_per_capita IS NOT NULL
GROUP BY classe ORDER BY ordem;`;
const SQL_CTX = `
SELECT iso_code, co2_per_capita, renovaveis_eletr FROM emissao
WHERE ano = 2022 AND iso_code IN ('BRA', 'OWID_WRL');`;
const SQL_PC = `
SELECT co2_per_capita FROM emissao e JOIN pais p ON p.iso_code = e.iso_code
WHERE e.ano = 2022 AND p.eh_agregado = 0 AND co2_per_capita IS NOT NULL
ORDER BY co2_per_capita;`;

function capitulo2() {
  const top = q(SQL_TOP);
  const total = q("SELECT SUM(co2_mt) AS t FROM emissao e JOIN pais p ON p.iso_code = e.iso_code WHERE ano = 2022 AND eh_agregado = 0")[0].t;
  const top10 = top.slice(0, 10).reduce((s, r) => s + r.co2_mt, 0) / total * 100;
  const rank = q(`SELECT COUNT(*) + 1 AS r FROM emissao e JOIN pais p ON p.iso_code = e.iso_code
                  WHERE ano = 2022 AND eh_agregado = 0 AND co2_mt > (SELECT co2_mt FROM emissao WHERE iso_code = 'BRA' AND ano = 2022)`)[0].r;
  const ctx = Object.fromEntries(q(SQL_CTX).map(r => [r.iso_code, r]));
  const pc = q(SQL_PC).map(r => r.co2_per_capita);
  const n = pc.length, soma = pc.reduce((a, b) => a + b, 0);
  const gini = (2 * pc.reduce((s, v, i) => s + (i + 1) * v, 0)) / (n * soma) - (n + 1) / n;

  preenche("top10", pct(top10)); preenche("rank", rank + "º");
  preenche("br_pc", fmt(ctx.BRA.co2_per_capita, 2)); preenche("mundo_pc", fmt(ctx.OWID_WRL.co2_per_capita, 2));
  preenche("renov", pct(ctx.BRA.renovaveis_eletr)); preenche("gini", fmt(gini, 2));
  mostraSQL("sql-cap2", SQL_TOP + "\n" + SQL_HIST + "\n" + SQL_CTX);

  new Chart("g-top", {
    type: "bar",
    data: { labels: top.map(r => r.nome_pt), datasets: [{ data: top.map(r => r.co2_mt), backgroundColor: top.map(r => (r.nome_pt === "Brasil" ? COR.verde : COR.cinza)), borderRadius: 3 }] },
    options: { indexAxis: "y", scales: { x: eixo(""), y: eixo("", { grid: { display: false } }) },
      plugins: { tooltip: { callbacks: { label: c => `${fmt(c.parsed.x)} Mt (${pct(top[c.dataIndex].participacao_mundial)} do mundo)` } } } }
  });
  const hist = q(SQL_HIST);
  new Chart("g-hist", {
    type: "bar",
    data: { labels: hist.map(r => r.classe), datasets: [{ data: hist.map(r => r.fi), backgroundColor: hist.map((_, i) => (i === 0 ? COR.verde : COR.cinza)), borderRadius: 3, barPercentage: .95, categoryPercentage: .95 }] },
    options: { scales: { x: eixo("t de CO₂ por habitante", { grid: { display: false } }), y: eixo("países") },
      plugins: { tooltip: { callbacks: { label: c => `${c.parsed.y} países` } },
        rotulos: { itens: [{ i: 0, texto: `${hist[0].fi} países, incluindo o Brasil`, dx: 30, dy: 18, cor: COR.verde }] } } }
  });
}

/* ---------- Capítulo 3: regressão e simulador ---------- */
const SQL_REG = `
-- Somatórios para a regressão linear simples (Y = CO2 em Mt, X = PIB em trilhões de int-$)
SELECT COUNT(*) AS n,
       SUM(pib / 1e12) AS sx, SUM(co2_mt) AS sy,
       SUM((pib / 1e12) * (pib / 1e12)) AS sxx, SUM(co2_mt * co2_mt) AS syy,
       SUM((pib / 1e12) * co2_mt) AS sxy
FROM emissao WHERE iso_code = 'BRA';
-- a = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²);  b = ȳ − a·x̄
-- r = (n·Σxy − Σx·Σy) / √[(n·Σx² − (Σx)²)(n·Σy² − (Σy)²)]`;

function capitulo3(br) {
  const s = q(SQL_REG)[0];
  const num = s.n * s.sxy - s.sx * s.sy;
  const a = num / (s.n * s.sxx - s.sx ** 2);
  const b = s.sy / s.n - a * s.sx / s.n;
  const r = num / Math.sqrt((s.n * s.sxx - s.sx ** 2) * (s.n * s.syy - s.sy ** 2));
  preenche("eq", `ŷ = ${fmt(a, 2)}x + ${fmt(b, 2)}`); preenche("r", fmt(r, 3)); preenche("a", fmt(a));
  const itens = painel(br); itens[3][2] = "r = " + fmt(r, 2);
  document.getElementById("painel").innerHTML = itens.map(([href, rot, val, br_]) =>
    `<div${br_ ? ' class="br"' : ""}><a href="${href}"><dt>${rot}</dt><dd>${val}</dd></a></div>`).join("");
  mostraSQL("sql-cap3", SQL_REG);

  const pontos = br.map(p => ({ x: p.pib_tri, y: p.co2_mt, ano: p.ano }));
  const xs = [Math.min(...pontos.map(p => p.x)) - .05, Math.max(...pontos.map(p => p.x)) + .05];
  const marcados = [1990, 2000, 2014, 2022];
  new Chart("g-reg", {
    type: "scatter",
    data: { datasets: [
      { data: pontos, backgroundColor: pontos.map(p => (p.ano > 2014 ? COR.verde : COR.grafite)), pointRadius: 5 },
      { type: "line", data: xs.map(x => ({ x, y: a * x + b })), borderColor: COR.laranja, borderWidth: 2, pointRadius: 0 },
    ] },
    options: { maintainAspectRatio: true,
      scales: { x: eixo("PIB (trilhões de int-$ de 2011)", { ticks: { callback: v => fmt(v, 1) } }), y: eixo("CO₂ (Mt)") },
      plugins: { tooltip: { callbacks: { label: c => (c.datasetIndex ? "reta de regressão" : `${c.raw.ano}: ${fmt(c.raw.y)} Mt`) } },
        rotulos: { itens: pontos.map((p, i) => ({ p, i })).filter(o => marcados.includes(o.p.ano)).map(o => ({ i: o.i, texto: String(o.p.ano), dx: 10, dy: o.p.ano === 2022 ? 18 : -10, cor: o.p.ano > 2014 ? COR.verde : COR.grafite })) } } }
  });

  const fim = br[br.length - 1];
  const intens22 = fim.co2_mt / fim.pib_tri;            // Mt de CO2 por trilhão de int-$ em 2022
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
}

/* ---------- Explorar: comparador ---------- */
const SQL_EX = `
SELECT e.iso_code, e.ano, e.co2_mt, e.co2_per_capita, e.co2_por_pib
FROM emissao e
WHERE e.iso_code IN ('BRA', ?)
ORDER BY e.iso_code, e.ano;`;
const ROT_IND = { co2_per_capita: ["t por habitante", 2], co2_por_pib: ["kg por int-$", 3], co2_mt: ["Mt", 0] };
let gEx;

function explorar() {
  const sel = document.getElementById("ex-pais");
  const paises = q(`SELECT p.iso_code, p.nome_pt FROM pais p
                    WHERE p.iso_code <> 'BRA' AND EXISTS (SELECT 1 FROM emissao e WHERE e.iso_code = p.iso_code AND e.ano = 2022)
                    ORDER BY p.eh_agregado DESC, p.nome_pt`);
  sel.innerHTML = paises.map(p => `<option value="${p.iso_code}">${p.nome_pt}</option>`).join("");
  const params = new URLSearchParams(location.hash.replace(/^#explorar\??/, ""));
  sel.value = paises.some(p => p.iso_code === params.get("pais")) ? params.get("pais") : "OWID_WRL";
  if (ROT_IND[params.get("ind")]) document.querySelector(`input[name="ex-ind"][value="${params.get("ind")}"]`).checked = true;
  let atual = { linhas: [], nome: "", ind: "" };
  const aviso = document.getElementById("ex-aviso");
  const desenha = () => {
    const iso = sel.value, nome = sel.options[sel.selectedIndex].text;
    const ind = document.querySelector('input[name="ex-ind"]:checked').value;
    document.querySelectorAll(".atalhos button").forEach(bt => bt.setAttribute("aria-pressed", String(bt.dataset.iso === iso)));
    aviso.textContent = "";
    const [unid, dec] = ROT_IND[ind];
    const linhas = q(SQL_EX, [iso]);
    const anos = [...new Set(linhas.map(l => l.ano))].sort();
    const serie = c => anos.map(a => { const l = linhas.find(x => x.iso_code === c && x.ano === a); return l ? l[ind] : null; });
    const sBr = serie("BRA"), sOu = serie(iso);
    atual = { anos, sBr, sOu, nome, ind, unid, dec, iso };
    const ult = arr => arr.filter(v => v != null).slice(-1)[0];
    const pri = arr => arr.find(v => v != null);
    mostraSQL("sql-ex", SQL_EX.replace("?", `'${iso}'`));
    kpis("kpi-ex", [
      [`Brasil em 2022`, `${fmt(ult(sBr), dec)} ${unid}`, true],
      [`${nome} em 2022`, ult(sOu) == null ? "sem dado" : `${fmt(ult(sOu), dec)} ${unid}`],
      [`Brasil desde 1990`, var_((ult(sBr) / pri(sBr) - 1) * 100)],
      [`${nome} desde 1990`, pri(sOu) ? var_((ult(sOu) / pri(sOu) - 1) * 100) : "sem dado"],
    ]);
    document.getElementById("ex-tabela").innerHTML =
      `<thead><tr><th scope="col">Ano</th><th scope="col">Brasil (${unid})</th><th scope="col">${nome} (${unid})</th></tr></thead><tbody>` +
      anos.map((an, i) => `<tr><th scope="row">${an}</th><td>${sBr[i] == null ? "–" : fmt(sBr[i], dec)}</td><td>${sOu[i] == null ? "–" : fmt(sOu[i], dec)}</td></tr>`).reverse().join("") + "</tbody>";
    const data = { labels: anos, datasets: [
      { data: sBr, borderColor: COR.verde, borderWidth: 3, pointRadius: 0, tension: .2, spanGaps: true },
      { data: sOu, borderColor: COR.grafite, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, tension: .2, spanGaps: true },
    ] };
    const opts = { maintainAspectRatio: true,
      scales: { x: eixo("", { ticks: { maxTicksLimit: 9 }, grid: { display: false } }), y: eixo(unid, { ticks: { callback: v => fmt(v, dec === 3 ? 2 : (dec ? 1 : 0)) } }) },
      plugins: { tooltip: { callbacks: { label: c => `${c.datasetIndex ? nome : "Brasil"}: ${fmt(c.parsed.y, dec)} ${unid}` } },
        rotulos: { itens: [
          { ds: 0, i: anos.length - 1, texto: "Brasil", dx: -4, dy: -10, align: "right", cor: COR.verde, peso: 800 },
          { ds: 1, i: anos.length - 1, texto: nome, dx: -4, dy: -10, align: "right", cor: COR.grafite, peso: 800 },
        ] } } };
    if (gEx) { gEx.data = data; gEx.options = opts; gEx.update(); } else gEx = new Chart("g-ex", { type: "line", data, options: opts });
  };
  sel.addEventListener("change", desenha);
  document.querySelectorAll('input[name="ex-ind"]').forEach(r => r.addEventListener("change", desenha));
  document.querySelectorAll(".atalhos button").forEach(bt => bt.addEventListener("click", () => { sel.value = bt.dataset.iso; desenha(); }));
  document.getElementById("ex-link").addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}#explorar?pais=${atual.iso}&ind=${atual.ind}`;
    try { await navigator.clipboard.writeText(url); aviso.textContent = "Link copiado. Quem abrir verá esta mesma comparação."; }
    catch { aviso.textContent = url; }
    history.replaceState(null, "", url);
  });
  document.getElementById("ex-csv").addEventListener("click", () => {
    const linhasCsv = [["ano", `brasil_${atual.ind}`, `${atual.iso.toLowerCase()}_${atual.ind}`].join(";"),
      ...atual.anos.map((an, i) => [an, atual.sBr[i] ?? "", atual.sOu[i] ?? ""].map(v => String(v).replace(".", ",")).join(";"))];
    const blob = new Blob(["\ufeff" + linhasCsv.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `comparacao_brasil_${atual.iso.toLowerCase()}_${atual.ind}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    aviso.textContent = "Arquivo CSV baixado (separador ponto e vírgula, abre no Excel).";
  });
  desenha();
}

/* ---------- Capítulo 4: pesquisa, propostas e metas ---------- */
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
    `<li><strong>${a.proposta}.</strong> Responde a: ${a.problema.toLowerCase()} (${a.evidencia}).
     <span class="meta-acao">Responsável: ${a.responsavel}. Prazo: ${a.prazo}. Custo: ${a.custo.toLowerCase()}.</span></li>`).join("");
  document.getElementById("metas").innerHTML = q(SQL_METAS).map(m => {
    const max = m.unidade === "%" ? 100 : (m.indicador.includes("0 a 9") ? 9 : 3);
    const d = m.unidade === "%" ? 0 : 1;
    const suf = m.unidade === "%" ? "%" : "";
    return `<div class="meta">${m.indicador}<div class="barra" role="img" aria-label="Atual ${fmt(m.atual, d)}${suf}, meta ${fmt(m.meta, d)}${suf}">
      <span class="atual" style="width:${m.atual / max * 100}%"></span><span class="alvo" style="left:calc(${m.meta / max * 100}% - 2px)"></span></div>
      <span class="valores">Hoje ${fmt(m.atual, d)}${suf}; meta ${fmt(m.meta, d)}${suf}</span></div>`;
  }).join("");
  mostraSQL("sql-q", SQL_PESQ + "\n\n" + SQL_ACOES + "\n" + SQL_METAS);
}

/* ---------- Console SQL ---------- */
const EXEMPLOS = {
  tabelas: "SELECT name AS tabela_ou_visao, type AS tipo\nFROM sqlite_master\nWHERE type IN ('table', 'view')\nORDER BY type, name;",
  brasil: "SELECT ano, co2_mt, co2_per_capita, co2_por_pib, ROUND(pib / 1e12, 3) AS pib_tri\nFROM emissao\nWHERE iso_code = 'BRA'\nORDER BY ano;",
  top: "SELECT p.nome_pt AS pais, e.co2_mt, e.co2_per_capita, e.participacao_mundial\nFROM emissao e\nJOIN pais p ON p.iso_code = e.iso_code\nWHERE e.ano = 2022 AND p.eh_agregado = 0\nORDER BY e.co2_mt DESC\nLIMIT 10;",
  pesquisa: "SELECT ROUND(AVG(separacao_residuos) * 100) AS separacao,\n       ROUND(AVG(controle_agua) * 100) AS agua,\n       ROUND(AVG(controle_energia) * 100) AS energia,\n       ROUND(AVG(desperdicio_visivel) * 100) AS desperdicio,\n       ROUND(AVG(usa_ferramenta_qualidade) * 100) AS ferramenta\nFROM pesquisa_resposta;",
  acoes: "SELECT id_acao, problema, proposta, iso_9001, iso_14001, prazo\nFROM acao_melhoria\nORDER BY id_acao;",
};
const LIMITE_LINHAS = 500;

function consoleSQL() {
  const ed = document.getElementById("sql-editor");
  const info = document.getElementById("sql-info");
  const tab = document.getElementById("sql-resultado");
  ed.value = EXEMPLOS.top;

  const esquema = q("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name")
    .map(t => {
      const cols = q(`PRAGMA table_info(${t.name})`).map(c => `  ${c.name}  ${c.type || ""}${c.pk ? "  (chave primária)" : ""}`).join("\n");
      return `${t.type === "view" ? "VISÃO" : "TABELA"} ${t.name}\n${cols}`;
    }).join("\n\n");
  document.getElementById("sql-esquema").textContent = esquema;

  const esc = s => String(s).replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
  const rodar = () => {
    const sql = ed.value.trim();
    info.classList.remove("erro");
    tab.innerHTML = "";
    if (!/^(select|with|pragma)\b/i.test(sql.replace(/^(--[^\n]*\n|\s)+/, ""))) {
      info.classList.add("erro");
      info.textContent = "Use apenas consultas de leitura: SELECT, WITH ou PRAGMA.";
      return;
    }
    const t0 = performance.now();
    try {
      const res = db.exec(sql);
      const ms = Math.round(performance.now() - t0);
      if (!res.length) { info.textContent = `Consulta executada em ${ms} ms, sem linhas no resultado.`; return; }
      const { columns, values } = res[res.length - 1];
      const mostra = values.slice(0, LIMITE_LINHAS);
      tab.innerHTML = `<thead><tr>${columns.map(c => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>` +
        mostra.map(l => `<tr>${l.map(v => (typeof v === "number"
          ? `<td class="num">${Number.isInteger(v) ? v : v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}</td>`
          : `<td>${v === null ? "<em>nulo</em>" : esc(v)}</td>`)).join("")}</tr>`).join("") + "</tbody>";
      info.textContent = `${values.length} linha(s) em ${ms} ms` + (values.length > LIMITE_LINHAS ? `; mostrando as ${LIMITE_LINHAS} primeiras.` : ".");
    } catch (e) {
      info.classList.add("erro");
      info.textContent = `Erro na consulta: ${e.message}`;
    }
  };
  document.getElementById("sql-rodar").addEventListener("click", rodar);
  ed.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); rodar(); } });
  document.querySelectorAll(".exemplos button").forEach(b => b.addEventListener("click", () => { ed.value = EXEMPLOS[b.dataset.sql]; rodar(); }));
  rodar();
}

/* Destaca no menu a seção que está na tela */
function marcarMenu() {
  const links = [...document.querySelectorAll(".topo nav a")];
  const obs = new IntersectionObserver(ents => ents.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(l => l.setAttribute("aria-current", String(l.getAttribute("href") === "#" + e.target.id)));
  }), { rootMargin: "-45% 0px -50% 0px" });
  links.forEach(l => { const s = document.querySelector(l.getAttribute("href")); if (s) obs.observe(s); });
}

/* ---------- Inicialização ---------- */
(async function iniciar() {
  const estado = document.getElementById("estado");
  try {
    const t0 = performance.now();
    const SQL = await initSqlJs({ locateFile: f => `vendor/${f}` });
    const resp = await fetch("data/projeto_ods.sqlite");
    if (!resp.ok) throw new Error(`não foi possível baixar o banco (HTTP ${resp.status})`);
    db = new SQL.Database(new Uint8Array(await resp.arrayBuffer()));
    const br = capitulo1();
    capitulo2();
    capitulo3(br);
    explorar();
    qualidade();
    consoleSQL();
    estado.textContent = "";
    marcarMenu();
    if (location.hash.startsWith("#explorar?")) document.getElementById("explorar").scrollIntoView();
    document.body.dataset.carregado = Math.round(performance.now() - t0);
  } catch (e) {
    estado.textContent = `O relatório não carregou: ${e.message}. Abra a página por um servidor (GitHub Pages ou "python -m http.server" na pasta app), e não direto pelo arquivo.`;
    console.error(e);
  }
})();
