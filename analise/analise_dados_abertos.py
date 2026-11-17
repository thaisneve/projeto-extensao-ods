"""Projeto ODS - Análise de dados abertos (Our World in Data, CO2 e PIB)
Uso: python analise/analise_dados_abertos.py analise/dados_brutos/owid-co2-data.csv analise/dados_brutos/owid-energy-data.csv
Gera: estatísticas no terminal, gráficos (od_g1..od_g3.png) e CSVs tratados para o MySQL.
"""
import sys, json, math
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mt

plt.rcParams["font.family"] = "DejaVu Sans"
AZUL, VERM, CINZA = "#1f4e79", "#c0392b", "#7f7f7f"
virg = lambda v, d=1: f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")

co2 = pd.read_csv(sys.argv[1])
energia = pd.read_csv(sys.argv[2])

# ---------- 1. Recorte A: Brasil, 1990-2022 ----------
br = co2[(co2.country == "Brazil") & co2.year.between(1990, 2022)][
    ["year", "population", "gdp", "co2", "co2_per_capita", "co2_per_gdp", "oil_co2"]].copy()
br["pib_tri"] = br["gdp"] / 1e12                       # trilhões de int-$ (2011)
assert br[["gdp", "co2"]].notna().all().all() and len(br) == 33
br.to_csv("brasil_1990_2022.csv", index=False)

# ---------- 2. Recorte B: países, 2022 ----------
pa = co2[(co2.year == 2022) & co2.iso_code.notna() & ~co2.iso_code.astype(str).str.startswith("OWID")][
    ["country", "iso_code", "population", "co2", "co2_per_capita", "share_global_co2"]].dropna(subset=["co2_per_capita", "co2"])
pa.to_csv("paises_2022.csv", index=False)
mundo = co2[(co2.country == "World") & (co2.year == 2022)].iloc[0]

def descritiva(s):
    s = s.astype(float)
    return {"n": int(s.count()), "media": s.mean(), "mediana": s.median(), "min": s.min(), "max": s.max(),
            "amplitude": s.max() - s.min(), "variancia": s.var(ddof=1), "dp": s.std(ddof=1),
            "cv": s.std(ddof=1) / s.mean() * 100}

def tabela_freq(s, k=None, inicio=None, h=None):
    s = s.astype(float); n = len(s)
    if k is None: k = round(1 + 3.322 * math.log10(n))                 # regra de Sturges
    if inicio is None: inicio = math.floor(s.min())
    if h is None: h = math.ceil((s.max() - inicio) / k * 10) / 10
    lim = [inicio + i * h for i in range(k + 1)]
    fi = [int(((s >= lim[i]) & ((s < lim[i + 1]) if i < k - 1 else (s <= lim[i + 1]))).sum()) for i in range(k)]
    t = pd.DataFrame({"li": lim[:-1], "ls": lim[1:], "fi": fi})
    t["fr"] = t.fi / n * 100; t["Fa"] = t.fi.cumsum(); t["Fr_ac"] = t.Fa / n * 100
    i = int(np.argmax(fi)); d1 = fi[i] - (fi[i - 1] if i > 0 else 0); d2 = fi[i] - (fi[i + 1] if i < k - 1 else 0)
    moda = lim[i] + d1 / (d1 + d2) * h if (d1 + d2) else lim[i] + h / 2     # moda de Czuber
    return t, moda, (lim[i], lim[i + 1])

res = {}
for nome, serie in (("co2_br", br.co2), ("int_br", br.co2_per_gdp), ("pc_paises", pa.co2_per_capita)):
    res[nome] = descritiva(serie)

t_co2, moda_co2, cm_co2 = tabela_freq(br.co2)
t_int, moda_int, cm_int = tabela_freq(br.co2_per_gdp, k=5, inicio=0.15, h=0.01)
t_pc, moda_pc, cm_pc = tabela_freq(pa.co2_per_capita, k=7, inicio=0, h=5)   # classes fixas de 5 t
# a última classe da tabela de países fica aberta (30 ou mais)
t_pc.loc[t_pc.index[-1], "fi"] = int((pa.co2_per_capita >= 30).sum())
t_pc["fr"] = t_pc.fi / len(pa) * 100; t_pc["Fa"] = t_pc.fi.cumsum(); t_pc["Fr_ac"] = t_pc.Fa / len(pa) * 100
res["co2_br"]["moda"] = moda_co2; res["int_br"]["moda"] = br.co2_per_gdp.round(3).mode().tolist(); res["pc_paises"]["moda"] = moda_pc

# Desigualdade entre países
ord_ = pa.sort_values("co2", ascending=False)
top10 = ord_.head(10)
res["top10_share"] = top10.co2.sum() / pa.co2.sum() * 100
res["top10"] = top10[["country", "co2", "share_global_co2", "co2_per_capita"]].round(3).values.tolist()
pc_ord = pa.co2_per_capita.sort_values().values
res["gini_pc"] = (2 * np.sum(np.arange(1, len(pc_ord) + 1) * pc_ord) / (len(pc_ord) * pc_ord.sum())) - (len(pc_ord) + 1) / len(pc_ord)
res["p90_p10"] = np.percentile(pa.co2_per_capita, 90) / np.percentile(pa.co2_per_capita, 10)
res["br_pc"] = float(pa.loc[pa.country == "Brazil", "co2_per_capita"].iloc[0])
res["br_share"] = float(pa.loc[pa.country == "Brazil", "share_global_co2"].iloc[0])
res["br_rank_total"] = int(ord_.reset_index(drop=True).index[ord_.reset_index(drop=True).country == "Brazil"][0] + 1)
res["mundo_pc"] = float(mundo.co2_per_capita)
res["pct_abaixo_br"] = float((pa.co2_per_capita < res["br_pc"]).mean() * 100)
res["pct_abaixo_media"] = float((pa.co2_per_capita < res["pc_paises"]["media"]).mean() * 100)

# Variações do Brasil
b90, b22 = br.iloc[0], br.iloc[-1]
res["var_co2"] = (b22.co2 / b90.co2 - 1) * 100
res["var_pib"] = (b22.gdp / b90.gdp - 1) * 100
res["var_int"] = (b22.co2_per_gdp / b90.co2_per_gdp - 1) * 100
res["br90"] = b90[["co2", "pib_tri", "co2_per_gdp"]].tolist(); res["br22"] = b22[["co2", "pib_tri", "co2_per_gdp"]].tolist()
res["pico"] = br.loc[br.co2.idxmax(), ["year", "co2"]].tolist()
e = energia[(energia.country == "Brazil") & (energia.year == 2022)].iloc[0]
em = energia[(energia.country == "World") & (energia.year == 2022)].iloc[0]
res["renov_br"] = float(e.renewables_share_elec); res["renov_mundo"] = float(em.renewables_share_elec)

# ---------- 3. Regressão: Y = CO2 (Mt), X = PIB (trilhões int-$) ----------
reg = stats.linregress(br.pib_tri, br.co2)
res["reg"] = {"a": reg.slope, "b": reg.intercept, "r": reg.rvalue, "r2": reg.rvalue ** 2, "p": reg.pvalue,
              "ep_a": reg.stderr}

# ---------- 4. Gráficos ----------
fig, axs = plt.subplots(1, 2, figsize=(8, 3.1), dpi=200)
axs[0].plot(br.year, br.co2, color=AZUL, lw=2)
axs[0].set_title("Emissões de CO₂ (Mt)", fontsize=9)
axs[1].plot(br.year, br.co2_per_gdp, color=VERM, lw=2)
axs[1].set_title("Intensidade de carbono (kg de CO₂ por int-$)", fontsize=9)
axs[1].yaxis.set_major_formatter(mt.FuncFormatter(lambda v, _: virg(v, 3)))
for ax in axs:
    ax.tick_params(labelsize=8); ax.spines[["top", "right"]].set_visible(False); ax.grid(alpha=0.3)
    ax.set_xticks(range(1990, 2023, 8))
plt.tight_layout(); plt.savefig("od_g1.png"); plt.close()

fig, ax = plt.subplots(figsize=(7.2, 3.4), dpi=200)
rot = [f"{int(a)}–{int(b)}" if i < len(t_pc) - 1 else f"{int(a)} ou mais" for i, (a, b) in enumerate(zip(t_pc.li, t_pc.ls))]
ax.bar(rot, t_pc.fi, color=AZUL, width=0.75)
for i, v in enumerate(t_pc.fi): ax.text(i, v + 1.5, str(v), ha="center", fontsize=8)
ax.set_xlabel("Emissões de CO₂ por habitante em 2022 (t/pessoa)", fontsize=8)
ax.set_ylabel("Número de países", fontsize=8)
ax.tick_params(labelsize=8); ax.spines[["top", "right"]].set_visible(False)
ax.text(1.6, t_pc.fi.iloc[0] * 0.75, f"Brasil ({virg(res['br_pc'],2)} t) e média mundial\n({virg(res['mundo_pc'],2)} t) estão na classe 0–5",
        fontsize=8, color=VERM)
ax.set_ylim(0, t_pc.fi.max() * 1.15)
plt.tight_layout(); plt.savefig("od_g2.png"); plt.close()

fig, ax = plt.subplots(figsize=(6.6, 3.8), dpi=200)
ax.scatter(br.pib_tri, br.co2, color=AZUL, s=22, zorder=3)
for _, r in br[br.year.isin([1990, 2000, 2010, 2014, 2020, 2022])].iterrows():
    ax.annotate(str(int(r.year)), (r.pib_tri, r.co2), xytext=(4, -10), textcoords="offset points", fontsize=7, color=CINZA)
xs = np.linspace(br.pib_tri.min() - 0.05, br.pib_tri.max() + 0.05, 10)
ax.plot(xs, reg.intercept + reg.slope * xs, color=VERM, lw=1.5,
        label=f"ŷ = {virg(reg.slope,2)}x + {virg(reg.intercept,2)}   (r = {virg(reg.rvalue,3)})")
ax.set_xlabel("PIB do Brasil (trilhões de int-$ de 2011) – X", fontsize=8)
ax.set_ylabel("Emissões de CO₂ (Mt) – Y", fontsize=8)
ax.xaxis.set_major_formatter(mt.FuncFormatter(lambda v, _: virg(v, 1)))
ax.legend(fontsize=8, frameon=False, loc="lower right")
ax.tick_params(labelsize=8); ax.spines[["top", "right"]].set_visible(False); ax.grid(alpha=0.3)
plt.tight_layout(); plt.savefig("od_g3.png"); plt.close()

# ---------- 5. Saída ----------
for nome, t in (("CO2 Brasil", t_co2), ("Intensidade Brasil", t_int), ("Per capita países", t_pc)):
    print("\n", nome); print(t.round(3).to_string(index=False))
res["t_co2"] = t_co2.round(4).values.tolist(); res["t_int"] = t_int.round(4).values.tolist(); res["t_pc"] = t_pc.round(4).values.tolist()
res["cm_co2"] = cm_co2; res["cm_int"] = cm_int; res["cm_pc"] = cm_pc
print(json.dumps({k: v for k, v in res.items() if not k.startswith("t_")}, indent=1, default=float))
json.dump(res, open("resultados.json", "w"), default=float, indent=1)
