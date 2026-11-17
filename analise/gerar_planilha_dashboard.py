"""Gera a planilha inteligente com dashboard (Excel) a partir do banco do MPV.
Uso (na raiz do repositório): python analise/gerar_planilha_dashboard.py
Saída: docs/Planilha_Inteligente_Dashboard_ODS.xlsx
"""
import sqlite3
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import LineChart, BarChart, ScatterChart, Reference, Series
from openpyxl.chart.trendline import Trendline
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

RAIZ = Path(__file__).resolve().parents[1]
DB = RAIZ / "app" / "data" / "projeto_ods.sqlite"
SAIDA = RAIZ / "docs" / "Planilha_Inteligente_Dashboard_ODS.xlsx"
con = sqlite3.connect(DB)
q = lambda s, p=(): con.execute(s, p).fetchall()

F = "Arial"
GRAF, VERDE, CINZA, AMAR = "1F2B30", "0E7A5A", "A3ADB0", "FFF2B3"
fT = Font(name=F, size=18, bold=True, color=GRAF)
fH = Font(name=F, size=11, bold=True, color="FFFFFF")
fB = Font(name=F, size=10)
fBb = Font(name=F, size=10, bold=True)
fN = Font(name=F, size=9, italic=True, color="4A575C")
fIn = Font(name=F, size=11, bold=True, color="0000FF")
fK = Font(name=F, size=20, bold=True, color=VERDE)
fKl = Font(name=F, size=9, color="4A575C")
fill_h = PatternFill("solid", fgColor=GRAF)
fill_in = PatternFill("solid", fgColor=AMAR)
fill_k = PatternFill("solid", fgColor="EEF3F1")
fina = Side(style="thin", color="C8D0CD")
borda = Border(left=fina, right=fina, top=fina, bottom=fina)
FONTE = "Fonte: Our World in Data – Data on CO2 and greenhouse gas emissions e Data on energy (CC BY 4.0), github.com/owid/co2-data; banco app/data/projeto_ods.sqlite."

def cab(ws, linha, nomes, col=1):
    for i, n in enumerate(nomes):
        c = ws.cell(linha, col + i, n); c.font = fH; c.fill = fill_h
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True); c.border = borda

def larg(ws, larguras):
    for col, w in larguras.items():
        ws.column_dimensions[col].width = w

def grafico_base(ch, titulo):
    ch.title = titulo; ch.roundedCorners = False
    if ch.legend is not None: ch.legend.overlay = False
    try:
        ch.x_axis.delete = False; ch.y_axis.delete = False
    except AttributeError:
        pass
    return ch

wb = Workbook()
dash = wb.active; dash.title = "Dashboard"

# ---------------------------------------------------------------- Dados Brasil
br = q("""SELECT ano, populacao, pib/1e12, co2_mt, co2_per_capita, co2_por_pib, co2_petroleo, renovaveis_eletr
          FROM emissao WHERE iso_code='BRA' ORDER BY ano""")
wsb = wb.create_sheet("Dados Brasil")
cab(wsb, 1, ["Ano", "População", "PIB (tri int-$ 2011)", "CO₂ (Mt)", "CO₂ por habitante (t)", "Intensidade (kg/int-$)", "CO₂ do petróleo (Mt)", "Eletricidade renovável (%)"])
for i, r in enumerate(br, start=2):
    for j, v in enumerate(r, start=1):
        c = wsb.cell(i, j, v); c.font = fB; c.border = borda
    wsb.cell(i, 1).number_format = "0"
    wsb.cell(i, 2).number_format = "#,##0"; wsb.cell(i, 3).number_format = "0.000"
    wsb.cell(i, 4).number_format = "#,##0.0"; wsb.cell(i, 5).number_format = "0.000"
    wsb.cell(i, 6).number_format = "0.000"; wsb.cell(i, 7).number_format = "#,##0.0"; wsb.cell(i, 8).number_format = "0.0"
NB = len(br); UB = NB + 1                                   # última linha de dados (34)
wsb.cell(UB + 2, 1, FONTE).font = fN
larg(wsb, {"A": 8, "B": 15, "C": 14, "D": 11, "E": 14, "F": 14, "G": 14, "H": 15})
wsb.freeze_panes = "A2"

# ---------------------------------------------------------------- Países 2022
pa = q("""SELECT p.nome_pt, e.iso_code, e.populacao, e.co2_mt, e.co2_per_capita, e.participacao_mundial
          FROM emissao e JOIN pais p ON p.iso_code=e.iso_code
          WHERE e.ano=2022 AND p.eh_agregado=0 AND e.co2_per_capita IS NOT NULL ORDER BY e.co2_mt DESC""")
mundo = q("SELECT co2_mt, co2_per_capita, renovaveis_eletr FROM emissao WHERE iso_code='OWID_WRL' AND ano=2022")[0]
wsp = wb.create_sheet("Países 2022")
cab(wsp, 1, ["País", "ISO", "População", "CO₂ (Mt)", "CO₂ por habitante (t)", "Participação mundial (%)", "Posição em volume", "Per capita em ordem crescente (auxiliar)"])
NP = len(pa); UP = NP + 1
for i, r in enumerate(pa, start=2):
    for j, v in enumerate(r, start=1):
        c = wsp.cell(i, j, v); c.font = fB; c.border = borda
    wsp.cell(i, 3).number_format = "#,##0"; wsp.cell(i, 4).number_format = "#,##0.0"
    wsp.cell(i, 5).number_format = "0.00"; wsp.cell(i, 6).number_format = "0.00"
    wsp.cell(i, 7, f"=RANK(D{i},$D$2:$D${UP},0)").font = fB
    wsp.cell(i, 8, f"=SMALL($E$2:$E${UP},ROW()-1)").font = fB; wsp.cell(i, 8).number_format = "0.000"
wsp.cell(UP + 2, 1, "Mundo (2022)").font = fBb
wsp.cell(UP + 2, 4, mundo[0]).number_format = "#,##0.0"; wsp.cell(UP + 2, 5, mundo[1]).number_format = "0.00"
wsp.cell(UP + 3, 1, "Eletricidade renovável no mundo (%)").font = fB; wsp.cell(UP + 3, 5, mundo[2]).number_format = "0.0"
wsp.cell(UP + 5, 1, FONTE).font = fN
MUNDO_PC = f"'Países 2022'!$E${UP + 2}"; MUNDO_REN = f"'Países 2022'!$E${UP + 3}"
larg(wsp, {"A": 30, "B": 7, "C": 15, "D": 11, "E": 14, "F": 14, "G": 11, "H": 16})
wsp.freeze_panes = "A2"
CO2B = f"'Dados Brasil'!$D$2:$D${UB}"; INTB = f"'Dados Brasil'!$F$2:$F${UB}"; PIBB = f"'Dados Brasil'!$C$2:$C${UB}"
PCP = f"'Países 2022'!$E$2:$E${UP}"; CO2P = f"'Países 2022'!$D$2:$D${UP}"

# ---------------------------------------------------------------- Estatística
wse = wb.create_sheet("Estatística")
wse["A1"] = "Estatística descritiva"; wse["A1"].font = fT
cab(wse, 3, ["Medida", "CO₂ do Brasil (Mt)", "Intensidade do Brasil (kg/int-$)", "CO₂ por habitante, países (t)"])
medidas = [
    ("n", "=COUNT({r})", "0"), ("Média", "=AVERAGE({r})", None), ("Mediana", "=MEDIAN({r})", None),
    ("Mínimo", "=MIN({r})", None), ("Máximo", "=MAX({r})", None), ("Amplitude", "=MAX({r})-MIN({r})", None),
    ("Variância (amostral)", "=VAR({r})", None), ("Desvio padrão (amostral)", "=STDEV({r})", None),
    ("Coeficiente de variação", "=STDEV({r})/AVERAGE({r})", "0.0%"),
]
fmts = ["#,##0.00", "0.0000", "0.00"]
for i, (nome, f, nf) in enumerate(medidas, start=4):
    wse.cell(i, 1, nome).font = fBb
    for j, rng in enumerate([CO2B, INTB, PCP]):
        c = wse.cell(i, 2 + j, f.format(r=rng)); c.font = fB; c.border = borda
        c.number_format = nf or fmts[j]
wse.cell(13, 1, "Moda").font = fBb
wse.cell(13, 2, "=B28").number_format = "#,##0.00"
wse["B13"].comment = Comment("Dados contínuos: moda de Czuber calculada na tabela de frequência abaixo (célula B28).", "Thais")
wse.cell(13, 3, f"=MODE({INTB})").number_format = "0.000"
wse["C13"].comment = Comment("A série é bimodal (0,151 e 0,156); a função MODA retorna o primeiro valor.", "Thais")
wse.cell(13, 4, "=D36").number_format = "0.00"
for c in ("B13", "C13", "D13"): wse[c].border = borda; wse[c].font = fB

# Frequência CO2 Brasil (Sturges)
wse["A16"] = "Distribuição de frequência das emissões do Brasil (regra de Sturges)"; wse["A16"].font = fBb
wse["A17"] = "Número de classes (k)"; wse["B17"] = "=ROUND(1+3.322*LOG10(B4),0)"
wse["A18"] = "Limite inferior inicial"; wse["B18"] = 218; wse["B18"].font = fIn; wse["B18"].fill = fill_in
wse["A19"] = "Amplitude da classe (h)"; wse["B19"] = 56.5; wse["B19"].font = fIn; wse["B19"].fill = fill_in
wse["C18"] = "Valor escolhido: inteiro abaixo do mínimo (218,66)"; wse["C19"] = "Valor escolhido: amplitude total / k, arredondada para cima"
for c in ("C18", "C19"): wse[c].font = fN
cab(wse, 20, ["Classe", "Limite inferior", "Limite superior", "fi", "fr", "Fa"])
for k in range(6):
    r = 21 + k
    wse.cell(r, 1, k + 1)
    wse.cell(r, 2, f"=$B$18+{k}*$B$19"); wse.cell(r, 3, f"=B{r}+$B$19")
    cond = f'"<"&C{r}' if k < 5 else f'"<="&C{r}'
    wse.cell(r, 4, f'=COUNTIFS({CO2B},">="&B{r},{CO2B},{cond})')
    wse.cell(r, 5, f"=D{r}/$B$4"); wse.cell(r, 5).number_format = "0.0%"
    wse.cell(r, 6, f"=SUM($D$21:D{r})")
    for j in range(1, 7): wse.cell(r, j).border = borda; wse.cell(r, j).font = fB
    wse.cell(r, 2).number_format = wse.cell(r, 3).number_format = "#,##0.0"
wse["A28"] = "Moda de Czuber (Mt)"; wse["A28"].font = fBb
# moda de Czuber: Li + (fi − f_anterior) / ((fi − f_anterior) + (fi − f_posterior)) × h
pos = "MATCH(MAX(D21:D26),D21:D26,0)"
wse["B28"] = (f"=INDEX(B21:B26,{pos})+(MAX(D21:D26)-IFERROR(INDEX(D20:D25,{pos})*1,0))/"
              f"((MAX(D21:D26)-IFERROR(INDEX(D20:D25,{pos})*1,0))+(MAX(D21:D26)-IFERROR(INDEX(D22:D27,{pos})*1,0)))*$B$19")
wse["B28"].number_format = "#,##0.00"
wse["B13"] = "=B28"

# Frequência per capita países (classes fixas de 5 t)
wse["A31"] = "Distribuição dos países por CO₂ por habitante em 2022 (classes de 5 t)"; wse["A31"].font = fBb
cab(wse, 32, ["Classe", "Limite inferior", "Limite superior", "fi", "fr", "Fa"])
for k in range(7):
    r = 33 + k
    wse.cell(r, 1, k + 1); wse.cell(r, 2, k * 5)
    if k < 6:
        wse.cell(r, 3, (k + 1) * 5); wse.cell(r, 4, f'=COUNTIFS({PCP},">="&B{r},{PCP},"<"&C{r})')
    else:
        wse.cell(r, 3, "ou mais"); wse.cell(r, 4, f'=COUNTIFS({PCP},">="&B{r})')
    wse.cell(r, 5, f"=D{r}/$D$4"); wse.cell(r, 5).number_format = "0.0%"; wse.cell(r, 6, f"=SUM($D$33:D{r})")
    for j in range(1, 7): wse.cell(r, j).border = borda; wse.cell(r, j).font = fB
# moda de Czuber dos países: classe modal é a primeira (sem classe anterior)
wse["A41"] = "Moda de Czuber (t/hab.)"; wse["A41"].font = fBb
wse["B41"] = "=B33+(D33-0)/((D33-0)+(D33-D34))*5"; wse["B41"].number_format = "0.00"
wse["D13"] = "=B41"

wse["A44"] = "Desigualdade entre os países (2022)"; wse["A44"].font = fBb
ind = [
    ("Participação dos 10 maiores emissores no total", f"=SUMPRODUCT(LARGE({CO2P},ROW(INDIRECT(\"1:10\"))))/SUM({CO2P})", "0.0%"),
    ("Índice de Gini do CO₂ por habitante", f"=2*SUMPRODUCT(ROW('Países 2022'!$H$2:$H${UP})-1,'Países 2022'!$H$2:$H${UP})/(COUNT('Países 2022'!$H$2:$H${UP})*SUM('Países 2022'!$H$2:$H${UP}))-(COUNT('Países 2022'!$H$2:$H${UP})+1)/COUNT('Países 2022'!$H$2:$H${UP})", "0.00"),
    ("Razão entre os percentis 90 e 10", f"=PERCENTILE({PCP},0.9)/PERCENTILE({PCP},0.1)", "0.0"),
    ("Países abaixo da média", f'=COUNTIF({PCP},"<"&D5)/D4', "0.0%"),
]
for i, (n, f, nf) in enumerate(ind, start=45):
    wse.cell(i, 1, n).font = fB; c = wse.cell(i, 2, f); c.number_format = nf; c.font = fBb; c.border = borda
larg(wse, {"A": 44, "B": 18, "C": 20, "D": 20, "E": 10, "F": 8})

# ---------------------------------------------------------------- Regressão
wsr = wb.create_sheet("Regressão")
wsr["A1"] = "Regressão linear simples: Y = CO₂ do Brasil (Mt), X = PIB (trilhões de int-$)"; wsr["A1"].font = fT
coef = [("Coeficiente angular (a)", f"=SLOPE({CO2B},{PIBB})", "0.00"), ("Coeficiente linear (b)", f"=INTERCEPT({CO2B},{PIBB})", "0.00"),
        ("Correlação (r)", f"=CORREL({PIBB},{CO2B})", "0.000"), ("Coeficiente de determinação (r²)", f"=RSQ({CO2B},{PIBB})", "0.000")]
for i, (n, f, nf) in enumerate(coef, start=3):
    wsr.cell(i, 1, n).font = fBb; c = wsr.cell(i, 2, f); c.number_format = nf; c.font = fB; c.border = borda
wsr["A7"] = "Equação"; wsr["A7"].font = fBb
wsr["B7"] = '="ŷ = "&FIXED(B3,2)&"x + "&FIXED(B4,2)'
cab(wsr, 9, ["Ano", "PIB (X)", "CO₂ observado (Y)", "CO₂ estimado (ŷ)", "Resíduo (Y − ŷ)"])
for i in range(NB):
    r = 10 + i; s = 2 + i
    wsr.cell(r, 1, f"='Dados Brasil'!A{s}"); wsr.cell(r, 2, f"='Dados Brasil'!C{s}"); wsr.cell(r, 3, f"='Dados Brasil'!D{s}")
    wsr.cell(r, 4, f"=$B$3*B{r}+$B$4"); wsr.cell(r, 5, f"=C{r}-D{r}")
    for j in range(1, 6): wsr.cell(r, j).border = borda; wsr.cell(r, j).font = fB
    wsr.cell(r, 2).number_format = "0.000"; wsr.cell(r, 3).number_format = wsr.cell(r, 4).number_format = wsr.cell(r, 5).number_format = "#,##0.0"
UR = 9 + NB
larg(wsr, {"A": 34, "B": 16, "C": 18, "D": 18, "E": 16})

# ---------------------------------------------------------------- Pesquisa
pesq = q("SELECT * FROM pesquisa_resposta ORDER BY id_resposta")
wsq = wb.create_sheet("Pesquisa")
wsq["A1"] = "Pesquisa com jovens aprendizes do Centro de Formação SENAI/Mercedes-Benz (1 = Sim, 0 = Não)"; wsq["A1"].font = fT
perg = ["Separação de resíduos", "Coleta seletiva", "Controle de água", "Controle de energia", "Descarte de perigosos",
        "Ações de sustentabilidade", "Orientação ambiental", "Desperdício visível (negativo)", "Reaproveitamento",
        "Organização dos processos", "Usa ferramenta da qualidade", "Visão sobre a qualidade"]
cab(wsq, 3, ["Respondente"] + perg + ["IPA (0 a 9)", "IGQ (0 a 3)"])
for i, r in enumerate(pesq):
    lin = 4 + i
    vals = list(r[3:14]) + [r[15]]
    wsq.cell(lin, 1, r[0])
    for j, v in enumerate(vals):
        wsq.cell(lin, 2 + j, v)
    wsq.cell(lin, 14, f"=SUM(B{lin}:H{lin})-I{lin}+1+J{lin}")
    wsq.cell(lin, 15, f"=K{lin}+L{lin}+M{lin}")
    for j in range(1, 16): wsq.cell(lin, j).border = borda; wsq.cell(lin, j).font = fB; wsq.cell(lin, j).alignment = Alignment(horizontal="center")
UQ = 3 + len(pesq)
wsq.cell(UQ + 1, 1, "% de Sim").font = fBb
wsq.cell(UQ + 2, 1, "Média").font = fBb
for j in range(2, 14):
    col = wsq.cell(3, j).column_letter
    c = wsq.cell(UQ + 1, j, f"=AVERAGE({col}4:{col}{UQ})"); c.number_format = "0%"; c.font = fBb; c.border = borda
for j in (14, 15):
    col = wsq.cell(3, j).column_letter
    c = wsq.cell(UQ + 2, j, f"=AVERAGE({col}4:{col}{UQ})"); c.number_format = "0.00"; c.font = fBb; c.border = borda
wsq.cell(UQ + 4, 1, "IPA = soma dos 9 itens ambientais com resposta favorável (no desperdício, a resposta favorável é Não). IGQ = organização + ferramenta + visão.").font = fN
wsq.cell(UQ + 5, 1, "Fonte: pesquisa própria (Microsoft Forms, 2º semestre de 2026), respostas anônimas.").font = fN
wsq.row_dimensions[3].height = 54
larg(wsq, {"A": 12, **{wsq.cell(3, j).column_letter: 12 for j in range(2, 16)}})
# tabela vertical para o gráfico
wsq.cell(UQ + 7, 1, "Pergunta").font = fBb; wsq.cell(UQ + 7, 2, "% Sim").font = fBb
for k, p in enumerate(perg):
    rr = UQ + 8 + k
    wsq.cell(rr, 1, p).font = fB
    wsq.cell(rr, 2, f"={wsq.cell(UQ + 1, 2 + k).coordinate}").number_format = "0%"
PQ_INI, PQ_FIM = UQ + 8, UQ + 8 + len(perg) - 1

# ---------------------------------------------------------------- Propostas e metas
wsm = wb.create_sheet("Propostas e metas")
wsm["A1"] = "Propostas de melhoria (ISO 9001 e ISO 14001) e metas"; wsm["A1"].font = fT
cab(wsm, 3, ["Nº", "Problema", "Evidência", "ISO 9001", "ISO 14001", "Proposta", "Responsável", "Prazo", "Custo"])
for i, r in enumerate(q("SELECT * FROM acao_melhoria ORDER BY id_acao"), start=4):
    for j, v in enumerate(r, start=1):
        c = wsm.cell(i, j, v); c.font = fB; c.border = borda; c.alignment = Alignment(wrap_text=True, vertical="top")
cab(wsm, 12, ["Nº", "Indicador", "Atual", "Meta", "Unidade", "Distância até a meta", "Como medir", "Resultado na próxima pesquisa", "Atingiu a meta?"])
metas = q("SELECT * FROM meta_indicador ORDER BY id_meta")
for i, r in enumerate(metas, start=13):
    for j, v in enumerate(r[:5], start=1):
        c = wsm.cell(i, j, v); c.font = fB; c.border = borda
    wsm.cell(i, 6, f"=D{i}-C{i}"); wsm.cell(i, 7, r[5])
    c = wsm.cell(i, 8); c.fill = fill_in; c.font = fIn; c.border = borda
    menor = "desperdício" in r[1].lower()
    wsm.cell(i, 9, f'=IF(H{i}="","Aguardando pesquisa",IF({"H%d<=D%d" % (i, i) if menor else "H%d>=D%d" % (i, i)},"Sim","Não"))')
    for j in (6, 7, 9): wsm.cell(i, j).font = fB; wsm.cell(i, j).border = borda
wsm.cell(21, 1, "Preencha a coluna H (amarela) com o resultado da nova pesquisa: a coluna I indica se a meta foi atingida. Exemplo: se a nova pesquisa der 35% de desperdício, digite 35.").font = fN
larg(wsm, {"A": 5, "B": 34, "C": 16, "D": 12, "E": 14, "F": 40, "G": 30, "H": 18, "I": 18})

# ---------------------------------------------------------------- Dashboard
d = dash
d.sheet_view.showGridLines = False
d["B2"] = "Carbono e riqueza – dashboard de dados abertos"; d["B2"].font = fT
d["B3"] = "Projeto de Extensão – 4º semestre | Informática para Negócios – Fatec São Bernardo do Campo | Banco de Dados, Programação, Estatística e Gestão da Qualidade | Thais Mendes da Silva"
d["B3"].font = fN
d["B4"] = "Células amarelas podem ser alteradas: o dashboard recalcula sozinho."; d["B4"].font = fN

kpi = [("B", "Intensidade de carbono 1990–2022", f"='Dados Brasil'!F{UB}/'Dados Brasil'!F2-1", "+0.0%;-0.0%"),
       ("E", "Emissões do Brasil em 2022 (Mt)", f"='Dados Brasil'!D{UB}", "#,##0"),
       ("H", "CO₂ por brasileiro em 2022 (t)", f"='Dados Brasil'!E{UB}", "0.00"),
       ("K", "Correlação PIB × CO₂ (r)", "=Regressão!B5", "0.000")]
for col, rot, f, nf in kpi:
    c0 = d[f"{col}6"]; c0.value = rot; c0.font = fKl; c0.fill = fill_k
    c1 = d[f"{col}7"]; c1.value = f; c1.font = fK; c1.number_format = nf; c1.fill = fill_k
    nxt = chr(ord(col) + 1); nxt2 = chr(ord(col) + 2)
    for cc in (f"{nxt}6", f"{nxt}7", f"{nxt2}6", f"{nxt2}7"): d[cc].fill = fill_k
d["B8"] = "Indicador 9.4.1 dos ODS"; d["E8"] = '="Pico: "&FIXED(MAX(' + CO2B + '),0)&" Mt em "&INDEX(\'Dados Brasil\'!$A$2:$A$' + str(UB) + ',MATCH(MAX(' + CO2B + '),' + CO2B + ',0))'
d["H8"] = '="Média mundial: "&FIXED(' + MUNDO_PC + ',2)&" t"'; d["K8"] = '=Regressão!B7'
for c in ("B8", "E8", "H8", "K8"): d[c].font = fN

# Comparador
d["B10"] = "Compare um país com o Brasil (2022)"; d["B10"].font = Font(name=F, size=13, bold=True, color=GRAF)
d["B11"] = "País:"; d["B11"].font = fBb
d["C11"] = "China"; d["C11"].font = fIn; d["C11"].fill = fill_in; d["C11"].border = borda
d.merge_cells("C11:E11")
dv = DataValidation(type="list", formula1=f"='Países 2022'!$A$2:$A${UP}", allow_blank=False)
dv.error = "Escolha um país da lista."; dv.prompt = "Escolha um país da lista"
d.add_data_validation(dv); dv.add("C11")
cab(d, 12, ["Indicador", "", "Brasil", "País escolhido"], col=2)
d.merge_cells("B12:C12")
linhas_cmp = [("CO₂ (Mt)", 4, "#,##0.0"), ("CO₂ por habitante (t)", 5, "0.00"), ("Participação mundial (%)", 6, "0.00"), ("Posição em volume", 7, "0")]
for k, (rot, colidx, nf) in enumerate(linhas_cmp):
    r = 13 + k
    d.cell(r, 2, rot).font = fB; d.merge_cells(f"B{r}:C{r}")
    col = "ABCDEFGH"[colidx - 1]
    d.cell(r, 4, f"=INDEX('Países 2022'!${col}$2:${col}${UP},MATCH(\"Brasil\",'Países 2022'!$A$2:$A${UP},0))").number_format = nf
    d.cell(r, 5, f"=INDEX('Países 2022'!${col}$2:${col}${UP},MATCH($C$11,'Países 2022'!$A$2:$A${UP},0))").number_format = nf
    for j in (2, 3, 4, 5): d.cell(r, j).border = borda
    d.cell(r, 4).font = fBb; d.cell(r, 5).font = fBb
d["B17"] = '="O país escolhido emite "&FIXED(E14/D14,1)&" vezes o CO₂ por habitante do Brasil."'; d["B17"].font = fN

# Simulador
d["H10"] = "Simulador: crescer sem emitir mais"; d["H10"].font = Font(name=F, size=13, bold=True, color=GRAF)
sim = [("PIB futuro (trilhões de int-$)", 4, "0.0", True), ("Redução da intensidade (%)", 0.10, "0%", True),
       ("Intensidade de 2022 (Mt por trilhão)", f"='Dados Brasil'!D{UB}/'Dados Brasil'!C{UB}", "0.0", False),
       ("Emissões pela tendência histórica (Mt)", "=Regressão!$B$3*K11+Regressão!$B$4", "#,##0", False),
       ("Emissões com a redução escolhida (Mt)", "=K13*(1-K12)*K11", "#,##0", False),
       ("Emissões de 2022 (Mt)", f"='Dados Brasil'!D{UB}", "#,##0", False),
       ("Redução mínima para não passar de 2022", "=MAX(0,1-K16/(K13*K11))", "0%", False)]
for k, (rot, v, nf, entrada) in enumerate(sim):
    r = 11 + k
    d.cell(r, 8, rot).font = fB; d.merge_cells(f"H{r}:J{r}")
    c = d.cell(r, 11, v); c.number_format = nf; c.border = borda
    c.font = fIn if entrada else fBb
    if entrada: c.fill = fill_in
d["H18"] = '=IF(K15<=K16,"Com essa redução, as emissões não passam de 2022.","Com essa redução, as emissões ainda ficam acima de 2022.")'; d["H18"].font = fN
d["K12"].comment = Comment("Digite a redução como porcentagem, por exemplo 20%.", "Thais")

# Pesquisa e metas (resumo)
d["B20"] = "Qualidade na prática (pesquisa com 10 aprendizes)"; d["B20"].font = Font(name=F, size=13, bold=True, color=GRAF)
res = [("Desperdício visível de materiais", f"=Pesquisa!I{UQ + 1}"), ("Uso de ferramenta da qualidade", f"=Pesquisa!L{UQ + 1}"),
       ("Controle do consumo de água", f"=Pesquisa!D{UQ + 1}"), ("Índice de Práticas Ambientais (IPA, 0 a 9)", f"=Pesquisa!N{UQ + 2}")]
for k, (rot, f) in enumerate(res):
    r = 21 + k
    d.cell(r, 2, rot).font = fB; d.merge_cells(f"B{r}:D{r}")
    c = d.cell(r, 5, f); c.font = fBb; c.border = borda; c.number_format = "0.0" if "IPA" in rot else "0%"
d["B25"] = "Metas atingidas na última pesquisa:"; d["B25"].font = fB
d["E25"] = "=COUNTIF('Propostas e metas'!I13:I19,\"Sim\")&\" de 7\""; d["E25"].font = fBb

larg(d, {"A": 2, "B": 16, "C": 12, "D": 14, "E": 16, "F": 9, "G": 9, "H": 16, "I": 12, "J": 12, "K": 14, "L": 12, "M": 12})
d.page_setup.orientation = "landscape"; d.page_setup.fitToWidth = 1; d.page_setup.fitToHeight = 0
d.sheet_properties.pageSetUpPr.fitToPage = True

# Gráficos
g1 = grafico_base(LineChart(), "Emissões de CO₂ do Brasil (Mt)")
g1.add_data(Reference(wsb, min_col=4, min_row=1, max_row=UB), titles_from_data=True)
g1.set_categories(Reference(wsb, min_col=1, min_row=2, max_row=UB))
g1.series[0].graphicalProperties.line.solidFill = GRAF; g1.series[0].graphicalProperties.line.width = 28000
g1.legend = None; g1.height = 7; g1.width = 13
d.add_chart(g1, "B28")

g2 = grafico_base(LineChart(), "Intensidade de carbono (kg de CO₂ por int-$)")
g2.add_data(Reference(wsb, min_col=6, min_row=1, max_row=UB), titles_from_data=True)
g2.set_categories(Reference(wsb, min_col=1, min_row=2, max_row=UB))
g2.series[0].graphicalProperties.line.solidFill = VERDE; g2.series[0].graphicalProperties.line.width = 28000
g2.legend = None; g2.height = 7; g2.width = 13; g2.y_axis.number_format = "0.000"; g2.y_axis.scaling.min = 0.14; g2.y_axis.scaling.max = 0.2
d.add_chart(g2, "H28")

g3 = grafico_base(BarChart(), "Os 12 maiores emissores em 2022 (Mt)")
g3.type = "bar"; g3.add_data(Reference(wsp, min_col=4, min_row=1, max_row=13), titles_from_data=True)
g3.set_categories(Reference(wsp, min_col=1, min_row=2, max_row=13))
g3.series[0].graphicalProperties.solidFill = CINZA
from openpyxl.chart.series import DataPoint
br_idx = [i for i, r in enumerate(pa[:12]) if r[1] == "BRA"]
for i in br_idx:
    pt = DataPoint(idx=i); pt.graphicalProperties.solidFill = VERDE; g3.series[0].dPt.append(pt)
g3.legend = None; g3.height = 10; g3.width = 13; g3.y_axis.scaling.orientation = "minMax"; g3.x_axis.scaling.orientation = "maxMin"
d.add_chart(g3, "B43")

g4 = grafico_base(BarChart(), "Países por faixa de CO₂ por habitante (2022)")
g4.add_data(Reference(wse, min_col=4, min_row=32, max_row=39), titles_from_data=True)
g4.set_categories(Reference(wse, min_col=2, min_row=33, max_row=39))
g4.series[0].graphicalProperties.solidFill = CINZA
pt = DataPoint(idx=0); pt.graphicalProperties.solidFill = VERDE; g4.series[0].dPt.append(pt)
g4.legend = None; g4.height = 10; g4.width = 13; g4.x_axis.title = "Limite inferior da faixa (t/hab.)"
d.add_chart(g4, "H43")

g5 = grafico_base(ScatterChart(), "PIB × CO₂ do Brasil, com reta de regressão")
s = Series(Reference(wsr, min_col=3, min_row=10, max_row=UR), Reference(wsr, min_col=2, min_row=10, max_row=UR), title="CO₂ observado")
s.marker.symbol = "circle"; s.marker.size = 6; s.graphicalProperties.line.noFill = True
s.marker.graphicalProperties.solidFill = GRAF; s.marker.graphicalProperties.line.solidFill = GRAF
s.trendline = Trendline(trendlineType="linear", dispEq=True, dispRSqr=True)
g5.series.append(s); g5.style = 13
g5.x_axis.title = "PIB (trilhões de int-$)"; g5.y_axis.title = "CO₂ (Mt)"; g5.legend = None
g5.x_axis.scaling.min = 1; g5.y_axis.scaling.min = 200; g5.height = 8; g5.width = 13
d.add_chart(g5, "B65")

g6 = grafico_base(BarChart(), "Pesquisa: % de respostas Sim")
g6.type = "bar"; g6.add_data(Reference(wsq, min_col=2, min_row=PQ_INI - 1, max_row=PQ_FIM), titles_from_data=True)
g6.set_categories(Reference(wsq, min_col=1, min_row=PQ_INI, max_row=PQ_FIM))
g6.series[0].graphicalProperties.solidFill = GRAF; g6.legend = None; g6.height = 8; g6.width = 13
g6.x_axis.scaling.orientation = "maxMin"; g6.y_axis.number_format = "0%"; g6.y_axis.scaling.max = 1; g6.y_axis.scaling.min = 0
d.add_chart(g6, "H65")

d["B82"] = FONTE; d["B82"].font = fN
d["B83"] = "Pesquisa: questionário próprio (Microsoft Forms), 10 jovens aprendizes do Centro de Formação SENAI/Mercedes-Benz, 2º semestre de 2026."; d["B83"].font = fN

# ---------------------------------------------------------------- Sobre
wss = wb.create_sheet("Sobre")
txt = [
    ("Sobre esta planilha", fT),
    ("Planilha inteligente do Projeto de Extensão do 4º semestre (Informática para Negócios – Fatec São Bernardo do Campo), disciplinas de Banco de Dados, Programação, Estatística e Gestão da Qualidade. Autora: Thais Mendes da Silva.", fB),
    ("", fB),
    ("Como usar", fBb),
    ("1. Na aba Dashboard, escolha um país na célula amarela C11 para comparar com o Brasil.", fB),
    ("2. No simulador (K11 e K12), altere o PIB futuro e a redução da intensidade de carbono.", fB),
    ("3. Na aba Propostas e metas, preencha a coluna H com o resultado da próxima pesquisa para saber se cada meta foi atingida.", fB),
    ("4. Os cálculos estatísticos ficam nas abas Estatística e Regressão e usam fórmulas: se os dados mudarem, tudo é recalculado.", fB),
    ("", fB),
    ("Legenda", fBb),
    ("Células amarelas com texto azul: entradas que podem ser alteradas. Texto preto: fórmulas e dados.", fB),
    ("", fB),
    ("Abas", fBb),
    ("Dashboard – números principais, comparador, simulador, qualidade e gráficos.", fB),
    ("Dados Brasil – série de 1990 a 2022 (CO₂, PIB, intensidade, petróleo, eletricidade renovável).", fB),
    ("Países 2022 – 218 países ordenados por emissões, com posição e coluna auxiliar para o Gini.", fB),
    ("Estatística – medidas descritivas, tabelas de frequência, moda de Czuber e desigualdade.", fB),
    ("Regressão – coeficientes, equação, valores estimados e resíduos.", fB),
    ("Pesquisa – respostas 0/1 dos aprendizes, % de Sim, IPA e IGQ.", fB),
    ("Propostas e metas – ações com base na ISO 9001 e na ISO 14001 e acompanhamento das metas.", fB),
    ("", fB),
    ("Fontes", fBb),
    (FONTE, fB),
    ("Código-fonte, banco de dados e aplicação web: https://github.com/thaisneve/projeto-extensao-ods", fB),
]
for i, (t, f) in enumerate(txt, start=1):
    c = wss.cell(i, 1, t); c.font = f; c.alignment = Alignment(wrap_text=True, vertical="top")
wss.column_dimensions["A"].width = 120

wb.move_sheet("Sobre", offset=-(len(wb.sheetnames) - 2))
SAIDA.parent.mkdir(exist_ok=True)
wb.save(SAIDA)
print("ok", SAIDA)
