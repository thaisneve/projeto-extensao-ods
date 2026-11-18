"""
ETL do Projeto de Extensão – 4º semestre (Informática para Negócios – Fatec SBC)
Autora: Thais Mendes da Silva

Lê os dados abertos do Our World in Data e a pesquisa com jovens aprendizes do
Centro de Formação SENAI/Mercedes-Benz e gera, a partir do MESMO modelo de dados:
  1) app/data/projeto_ods.sqlite          -> banco usado pela aplicação web (sql.js)
  2) database/mysql/projeto_ods_mpv.sql   -> script MySQL 8 / MariaDB documentado

Uso (na raiz do repositório):
    python database/etl/gerar_banco.py
"""
import csv
import sqlite3
from pathlib import Path

import pandas as pd
import pycountry
from babel import Locale

RAIZ = Path(__file__).resolve().parents[2]
BRUTOS = RAIZ / "analise" / "dados_brutos"
SQLITE = RAIZ / "app" / "data" / "projeto_ods.sqlite"
MYSQL = RAIZ / "database" / "mysql" / "projeto_ods_mpv.sql"
ANO_INI, ANO_FIM = 1990, 2022          # 2022 = último ano com PIB na base

# ----------------------------------------------------------------------------
# 1. Modelo de dados (DDL comum; tipos compatíveis com MySQL e SQLite)
# ----------------------------------------------------------------------------
DDL = """
-- Países e agregados (o Mundo é guardado com eh_agregado = 1)
CREATE TABLE pais (
  iso_code     VARCHAR(8)   NOT NULL PRIMARY KEY,   -- código ISO 3166-1 alfa-3 (OWID_WRL = Mundo)
  nome_en      VARCHAR(80)  NOT NULL,               -- nome original na base
  nome_pt      VARCHAR(80)  NOT NULL,               -- nome em português
  eh_agregado  SMALLINT     NOT NULL DEFAULT 0
);

-- Fato anual de emissões por país (1990–2022)
CREATE TABLE emissao (
  iso_code             VARCHAR(8)     NOT NULL,
  ano                  SMALLINT       NOT NULL,
  populacao            BIGINT         NULL,          -- habitantes
  pib                  DOUBLE         NULL,          -- int-$ a preços de 2011 (Maddison)
  co2_mt               DECIMAL(10,3)  NULL,          -- milhões de toneladas de CO2
  co2_per_capita       DECIMAL(8,3)   NULL,          -- t de CO2 por habitante
  co2_por_pib          DECIMAL(6,3)   NULL,          -- kg de CO2 por int-$ (indicador ODS 9.4.1)
  co2_petroleo         DECIMAL(10,3)  NULL,          -- Mt de CO2 da queima de petróleo
  participacao_mundial DECIMAL(6,3)   NULL,          -- % das emissões mundiais
  renovaveis_eletr     DECIMAL(6,3)   NULL,          -- % da eletricidade de fontes renováveis
  PRIMARY KEY (iso_code, ano),
  FOREIGN KEY (iso_code) REFERENCES pais (iso_code)
);

-- Respostas da pesquisa com jovens aprendizes (1 = Sim, 0 = Não)
CREATE TABLE pesquisa_resposta (
  id_resposta              INT          NOT NULL PRIMARY KEY,
  inicio                   VARCHAR(19)  NOT NULL,
  conclusao                VARCHAR(19)  NOT NULL,
  separacao_residuos       SMALLINT     NOT NULL,
  coleta_seletiva          SMALLINT     NOT NULL,
  controle_agua            SMALLINT     NOT NULL,
  controle_energia         SMALLINT     NOT NULL,
  descarte_perigosos       SMALLINT     NOT NULL,
  acoes_sustentabilidade   SMALLINT     NOT NULL,
  orientacao_ambiental     SMALLINT     NOT NULL,
  desperdicio_visivel      SMALLINT     NOT NULL,          -- item negativo
  reaproveitamento         SMALLINT     NOT NULL,
  organizacao_processos    SMALLINT     NOT NULL,
  usa_ferramenta_qualidade SMALLINT     NOT NULL,
  ferramenta_citada        VARCHAR(100) NULL,
  visao_qualidade          SMALLINT     NOT NULL
);

-- Propostas de melhoria (diagnóstico de qualidade + ISO 9001 / ISO 14001)
CREATE TABLE acao_melhoria (
  id_acao      INT           NOT NULL PRIMARY KEY,
  problema     VARCHAR(120)  NOT NULL,
  evidencia    VARCHAR(80)   NOT NULL,
  iso_9001     VARCHAR(40)   NOT NULL,
  iso_14001    VARCHAR(40)   NOT NULL,
  proposta     VARCHAR(200)  NOT NULL,
  responsavel  VARCHAR(120)  NOT NULL,
  prazo        VARCHAR(40)   NOT NULL,
  custo        VARCHAR(60)   NOT NULL
);

-- Metas dos resultados esperados
CREATE TABLE meta_indicador (
  id_meta     INT           NOT NULL PRIMARY KEY,
  indicador   VARCHAR(120)  NOT NULL,
  atual       DECIMAL(6,2)  NOT NULL,
  meta        DECIMAL(6,2)  NOT NULL,
  unidade     VARCHAR(10)   NOT NULL,
  medicao     VARCHAR(160)  NOT NULL
);
"""

VIEWS = """
-- Índices por respondente: IPA (0 a 9) e IGQ (0 a 3)
CREATE VIEW vw_indices_pesquisa AS
SELECT id_resposta,
  separacao_residuos + coleta_seletiva + controle_agua + controle_energia + descarte_perigosos
  + acoes_sustentabilidade + orientacao_ambiental + (1 - desperdicio_visivel) + reaproveitamento AS ipa,
  organizacao_processos + usa_ferramenta_qualidade + visao_qualidade AS igq
FROM pesquisa_resposta;

-- Emissões com o nome do país
CREATE VIEW vw_emissao AS
SELECT e.*, p.nome_pt, p.eh_agregado
FROM emissao e JOIN pais p ON p.iso_code = e.iso_code;
"""

# ----------------------------------------------------------------------------
# 2. Extração e transformação
# ----------------------------------------------------------------------------
co2 = pd.read_csv(BRUTOS / "owid-co2-data.csv")
energia = pd.read_csv(BRUTOS / "owid-energy-data.csv")
energia.loc[energia.country == "World", "iso_code"] = "OWID_WRL"
energia = energia[["iso_code", "year", "renewables_share_elec"]]

co2.loc[co2.country == "World", "iso_code"] = "OWID_WRL"            # o Mundo não tem código na base
co2 = co2[co2.year.between(ANO_INI, ANO_FIM) & co2.iso_code.notna()]
co2 = co2[(~co2.iso_code.str.startswith("OWID")) | (co2.iso_code == "OWID_WRL")]
co2 = co2.merge(energia, on=["iso_code", "year"], how="left")
co2 = co2[co2.co2.notna()]

pt = Locale("pt", "BR").territories
def nome_pt(iso3, nome_en):
    if iso3 == "OWID_WRL":
        return "Mundo"
    if iso3 == "COD":
        return "República Democrática do Congo"
    if iso3 == "COG":
        return "República do Congo"
    c = pycountry.countries.get(alpha_3=iso3)
    return pt.get(c.alpha_2, nome_en) if c else nome_en

paises = (co2[["iso_code", "country"]].drop_duplicates("iso_code")
          .assign(nome_pt=lambda d: [nome_pt(i, n) for i, n in zip(d.iso_code, d.country)],
                  eh_agregado=lambda d: (d.iso_code == "OWID_WRL").astype(int))
          .sort_values("nome_pt"))

emis = co2[["iso_code", "year", "population", "gdp", "co2", "co2_per_capita", "co2_per_gdp",
            "oil_co2", "share_global_co2", "renewables_share_elec"]]

with open(BRUTOS / "pesquisa_aprendizes_senai.csv", encoding="utf-8") as f:
    pesq = list(csv.reader(f))[1:]

ACOES = [
    (1, "Baixo reconhecimento das ferramentas da qualidade", "80% responderam Não", "7.1.6; 7.2; 7.3", "7.2; 7.3",
     "Módulo prático de ferramentas da qualidade (NAPCD, PDCA, 5S, Ishikawa) no programa de aprendizagem",
     "Coordenação pedagógica do SENAI e Qualidade da Mercedes-Benz", "Fev. a jun. 2027", "Baixo"),
    (2, "Baixa percepção do controle de água e energia", "50% e 30% responderam Não", "7.4; 9.1", "7.4.2; 9.1.1; ISO 14031",
     "Painéis de gestão à vista com consumo de água, energia e resíduos por setor, usados também em aula",
     "Gestão Ambiental e Engenharia de Utilidades", "Fev. 2027", "Baixo"),
    (3, "Desperdício visível de materiais", "60% responderam Sim", "8.5.1; 10.3", "6.1.2; 6.2; 8.1",
     "Programa Caça ao Desperdício e abastecimento dos postos por kits",
     "Supervisores de produção, Logística interna e Melhoria Contínua", "Mar. a jun. 2027", "Médio"),
    (4, "Placas desgastadas e respingos de óleo no descarte", "Fotos da visita", "7.1.4; 7.5", "8.1; 8.2",
     "5S nos pontos de descarte, placas resistentes a óleo, bandejas de contenção e funis com tampa",
     "Líderes de equipe com apoio da Qualidade", "A partir de mar. 2027", "Baixo"),
    (5, "Vazamentos de água, óleo e ar comprimido", "Diagrama de Ishikawa", "7.1.3", "8.1; 9.1; ISO 50001",
     "Rotas de inspeção, etiquetas de identificação e prazo para correção de vazamentos",
     "Manutenção e Engenharia de Utilidades", "Fev. a abr. 2027", "Médio"),
    (6, "Diferença entre controles existentes e percepção", "Pesquisa x certificações", "9.1; 9.3; 10.3", "9.1; 9.3; 10.3",
     "Reaplicação semestral da pesquisa com cada turma e acompanhamento do IPA e do IGQ",
     "SENAI e Mercedes-Benz (análise crítica)", "Semestral", "Baixo"),
]
METAS = [
    (1, "Reconhecimento do uso de ferramentas da qualidade", 20, 70, "%", "Reaplicação do questionário e registro dos treinamentos"),
    (2, "Percepção de desperdício visível de materiais", 60, 30, "%", "Reaplicação do questionário e registros do Caça ao Desperdício"),
    (3, "Percepção de controle do consumo de água", 50, 80, "%", "Reaplicação do questionário e consumo de água por setor"),
    (4, "Percepção de controle do consumo de energia", 70, 90, "%", "Reaplicação do questionário e consumo de energia por setor"),
    (5, "Orientação ambiental aos aprendizes", 90, 100, "%", "Reaplicação do questionário e lista de presença"),
    (6, "Índice de Práticas Ambientais (IPA, 0 a 9)", 7.4, 8.3, "pontos", "Cálculo do índice com os novos dados"),
    (7, "Índice de Gestão da Qualidade (IGQ, 0 a 3)", 2.1, 2.6, "pontos", "Cálculo do índice com os novos dados"),
]

def linhas_pesquisa():
    for r in pesq:
        b = [1 if x == "Sim" else 0 for x in r[3:14]]
        yield (int(r[0]), r[1], r[2], *b, (r[14] or None), 1 if r[15] == "Sim" else 0)

def num(v):
    return None if pd.isna(v) else float(v)

# ----------------------------------------------------------------------------
# 3. Carga no SQLite (aplicação web)
# ----------------------------------------------------------------------------
SQLITE.unlink(missing_ok=True)
con = sqlite3.connect(SQLITE)
con.executescript(DDL + VIEWS)
con.executemany("INSERT INTO pais VALUES (?,?,?,?)", paises[["iso_code", "country", "nome_pt", "eh_agregado"]].values.tolist())
con.executemany("INSERT INTO emissao VALUES (?,?,?,?,?,?,?,?,?,?)",
                [(r[0], int(r[1]), None if pd.isna(r[2]) else int(r[2]), *[num(x) for x in r[3:]]) for r in emis.itertuples(index=False)])
con.executemany("INSERT INTO pesquisa_resposta VALUES (" + ",".join("?" * 16) + ")", list(linhas_pesquisa()))
con.executemany("INSERT INTO acao_melhoria VALUES (?,?,?,?,?,?,?,?,?)", ACOES)
con.executemany("INSERT INTO meta_indicador VALUES (?,?,?,?,?,?)", METAS)
# Índice de alerta: tabela derivada do próprio banco (database/indice_alerta.sql)
con.executescript((RAIZ / "database" / "indice_alerta.sql").read_text(encoding="utf-8"))
con.commit(); con.execute("VACUUM"); con.close()

# ----------------------------------------------------------------------------
# 4. Script MySQL equivalente
# ----------------------------------------------------------------------------
def q(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return "NULL"
    if isinstance(v, str):
        return "'" + v.replace("'", "''") + "'"
    return repr(v) if isinstance(v, float) else str(v)

def inserts(tabela, linhas, lote=500):
    out = []
    for i in range(0, len(linhas), lote):
        out.append(f"INSERT INTO {tabela} VALUES\n" + ",\n".join("(" + ", ".join(q(x) for x in l) + ")" for l in linhas[i:i + lote]) + ";")
    return "\n".join(out)

cab = f"""-- =============================================================================
-- Projeto de Extensão – 4º semestre – MPV de relatório estatístico de dados abertos
-- Banco: projeto_ods_mpv (MySQL 8 / MariaDB 10.5+)
-- Autora: Thais Mendes da Silva – Informática para Negócios – Fatec São Bernardo do Campo
-- Fontes: Our World in Data (CO2 e energia, CC BY 4.0) e pesquisa com jovens aprendizes
--         do Centro de Formação SENAI/Mercedes-Benz. Gerado por database/etl/gerar_banco.py
-- =============================================================================
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS projeto_ods_mpv CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE projeto_ods_mpv;
DROP VIEW IF EXISTS vw_indices_pesquisa;
DROP VIEW IF EXISTS vw_emissao;
DROP TABLE IF EXISTS indice_alerta;
DROP TABLE IF EXISTS emissao;
DROP TABLE IF EXISTS pais;
DROP TABLE IF EXISTS pesquisa_resposta;
DROP TABLE IF EXISTS acao_melhoria;
DROP TABLE IF EXISTS meta_indicador;
"""
emis_rows = [(r[0], int(r[1]), None if pd.isna(r[2]) else int(r[2]), *[num(x) for x in r[3:]]) for r in emis.itertuples(index=False)]
MYSQL.write_text(
    cab + DDL.replace("SMALLINT     NOT NULL DEFAULT 0", "TINYINT(1)   NOT NULL DEFAULT 0") + "\n" +
    inserts("pais", paises[["iso_code", "country", "nome_pt", "eh_agregado"]].values.tolist()) + "\n\n" +
    inserts("emissao", emis_rows) + "\n\n" +
    inserts("pesquisa_resposta", list(linhas_pesquisa())) + "\n\n" +
    inserts("acao_melhoria", ACOES) + "\n\n" + inserts("meta_indicador", METAS) + "\n" + VIEWS + "\n" +
    (RAIZ / "database" / "indice_alerta.sql").read_text(encoding="utf-8") +
    "\n-- Consultas de análise: ver database/mysql/consultas_analise.sql\n", encoding="utf-8")

print(f"SQLite: {SQLITE} ({SQLITE.stat().st_size/1024:.0f} KB) | países: {len(paises)} | linhas de emissão: {len(emis)}")
print(f"MySQL:  {MYSQL} ({MYSQL.stat().st_size/1024:.0f} KB)")
