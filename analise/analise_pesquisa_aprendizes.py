"""Projeto ODS - Estatística descritiva e regressão linear
Dados: pesquisa de avaliação da gestão da qualidade e ambiental (Microsoft Forms)
Uso: python analise/analise_pesquisa_aprendizes.py <planilha exportada do Forms (.xlsx)>
"""
import sys
import pandas as pd
import numpy as np
from scipy import stats
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker

plt.rcParams["font.family"] = "DejaVu Sans"
AZUL, CLARO = "#1f4e79", "#b4c7dc"

# 1. Leitura e limpeza: remove colunas vazias geradas pelo Forms
df = pd.read_excel(sys.argv[1])
df = df.drop(columns=[c for c in df.columns
                      if str(c).startswith(("Pontos", "Comentários"))
                      or c in ("Email", "Nome", "Total de pontos",
                               "Comentários do teste", "Hora de postagem da nota")])
nomes = {
    "A empresa realiza separação de resíduos?": "separacao_residuos",
    "Existe coleta seletiva?": "coleta_seletiva",
    "Há controle do consumo de água?": "controle_agua",
    "Há controle do consumo de energia?": "controle_energia",
    "Existe descarte correto de resíduos perigosos?": "descarte_perigosos",
    "A empresa possui ações de sustentabilidade?": "acoes_sustentabilidade",
    "Funcionários recebem orientação ambiental": "orientacao_ambiental",
    "Há desperdício visível de materiais?": "desperdicio_visivel",
    "Existem práticas de reaproveitamento de materiais?": "reaproveitamento",
    "O local possui organização adequada dos processos?": "organizacao_processos",
    "A empresa trabalha com alguma ferramenta da qualidade?": "usa_ferramenta_qualidade",
    "Se sim, qual ferramenta?\n": "ferramenta_citada",
    "Existe uma visão sobre a qualidade na empresa?": "visao_qualidade",
}
df = df.rename(columns=nomes)
binarias = [v for v in nomes.values() if v != "ferramenta_citada"]
df[binarias] = (df[binarias] == "Sim").astype(int)          # Sim = 1, Não = 0
df["ferramenta_citada"] = df["ferramenta_citada"].str.strip()

# 2. Índices por respondente
amb = ["separacao_residuos", "coleta_seletiva", "controle_agua", "controle_energia",
       "descarte_perigosos", "acoes_sustentabilidade", "orientacao_ambiental",
       "reaproveitamento"]
df["ipa"] = df[amb].sum(axis=1) + (1 - df["desperdicio_visivel"])   # 0 a 9
df["igq"] = df[["organizacao_processos", "usa_ferramenta_qualidade",
                "visao_qualidade"]].sum(axis=1)                         # 0 a 3

# 3. Estatística descritiva
def descritiva(s):
    return {"Média": s.mean(), "Mediana": s.median(), "Moda": s.mode().tolist(),
            "Mínimo": s.min(), "Máximo": s.max(), "Amplitude": s.max() - s.min(),
            "Variância": s.var(ddof=1), "Desvio padrão": s.std(ddof=1),
            "CV (%)": s.std(ddof=1) / s.mean() * 100}

for col in ("ipa", "igq"):
    print(col.upper(), descritiva(df[col]))
    freq = df[col].value_counts().sort_index()
    print(pd.DataFrame({"fi": freq, "fr (%)": freq / len(df) * 100}))

pct = df[binarias].mean() * 100
print(pct.round(1))

# 4. Regressão linear simples: Y = IPA, X = IGQ
reg = stats.linregress(df["igq"], df["ipa"])
print(f"r = {reg.rvalue:.3f}  r2 = {reg.rvalue**2:.3f}  "
      f"y = {reg.slope:.3f}x + {reg.intercept:.3f}  p = {reg.pvalue:.3f}")

# 5. Gráficos
rotulos = {"separacao_residuos": "Separação de resíduos", "coleta_seletiva": "Coleta seletiva",
           "controle_agua": "Controle do consumo de água",
           "controle_energia": "Controle do consumo de energia",
           "descarte_perigosos": "Descarte correto de perigosos",
           "acoes_sustentabilidade": "Ações de sustentabilidade",
           "orientacao_ambiental": "Orientação ambiental",
           "desperdicio_visivel": "Desperdício visível de materiais",
           "reaproveitamento": "Reaproveitamento de materiais",
           "organizacao_processos": "Organização dos processos",
           "usa_ferramenta_qualidade": "Uso de ferramenta da qualidade",
           "visao_qualidade": "Visão sobre a qualidade"}
p = pct.rename(rotulos)[::-1]
fig, ax = plt.subplots(figsize=(7.5, 4.6), dpi=200)
ax.barh(p.index, p.values, color=AZUL)
for i, v in enumerate(p.values):
    ax.text(v + 1.5, i, f"{v:.0f}%", va="center", fontsize=8)
ax.set_xlim(0, 110); ax.set_xlabel("Respostas “Sim” (%)", fontsize=9)
ax.tick_params(labelsize=8); ax.spines[["top", "right"]].set_visible(False)
plt.tight_layout(); plt.savefig("ods_g1.png"); plt.close()

fig, axs = plt.subplots(1, 2, figsize=(7.5, 3.2), dpi=200)
for ax, col, rng, tit in ((axs[0], "ipa", range(0, 10), "IPA (0 a 9)"),
                          (axs[1], "igq", range(0, 4), "IGQ (0 a 3)")):
    f = df[col].value_counts().reindex(rng, fill_value=0)
    ax.bar(f.index, f.values, color=AZUL, width=0.7)
    for x, y in zip(f.index, f.values):
        if y: ax.text(x, y + 0.1, str(y), ha="center", fontsize=8)
    ax.set_xticks(list(rng)); ax.set_title(tit, fontsize=9)
    ax.set_xlabel("Pontuação", fontsize=8); ax.set_ylabel("Frequência", fontsize=8)
    ax.set_ylim(0, 8); ax.tick_params(labelsize=8); ax.spines[["top", "right"]].set_visible(False)
plt.tight_layout(); plt.savefig("ods_g2.png"); plt.close()

cont = df.groupby(["igq", "ipa"]).size().reset_index(name="n")
fig, ax = plt.subplots(figsize=(6.5, 3.8), dpi=200)
ax.scatter(cont["igq"], cont["ipa"], s=cont["n"] * 120, color=AZUL, alpha=0.85, zorder=3)
for _, r in cont.iterrows():
    ax.annotate(f"n = {r['n']}", (r["igq"], r["ipa"]), xytext=(12, 6),
                textcoords="offset points", fontsize=8)
xs = np.linspace(0.8, 3.2, 10)
ax.plot(xs, reg.intercept + reg.slope * xs, color="#c0392b", lw=1.5,
        label=f"ŷ = {reg.slope:.3f}x + {reg.intercept:.3f}   (r = {reg.rvalue:.3f})".replace(".", ","))
ax.set_xticks([1, 2, 3]); ax.set_xlim(0.6, 3.6); ax.set_ylim(5.5, 8.7)
ax.set_xlabel("IGQ – Índice de Gestão da Qualidade (X)", fontsize=8)
ax.set_ylabel("IPA – Índice de Práticas Ambientais (Y)", fontsize=8)
ax.legend(fontsize=8, frameon=False, loc="lower right")
ax.tick_params(labelsize=8); ax.spines[["top", "right"]].set_visible(False)
ax.grid(alpha=0.3)
ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:.1f}".replace(".", ",")))
plt.tight_layout(); plt.savefig("ods_g3.png"); plt.close()
