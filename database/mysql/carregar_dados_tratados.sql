-- =============================================================================
-- Carga do banco projeto_ods_tratado a partir dos CSV de dados_tratados/
-- Projeto de Extensão – 4º semestre – Informática para Negócios – Fatec SBC
-- Autora: Thais Mendes da Silva
--
-- Como executar (na RAIZ do repositório, para os caminhos dos CSV funcionarem):
--   mysql -u root --local-infile=1 < database/mysql/carregar_dados_tratados.sql
-- No MySQL 8, habilite antes a carga local no servidor (uma vez, como administrador):
--   SET GLOBAL local_infile = 1;
-- Os CSV usam UTF-8, vírgula como separador, ponto decimal e campo vazio para nulo.
-- =============================================================================
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS projeto_ods_tratado CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE projeto_ods_tratado;
DROP VIEW IF EXISTS vw_indices_pesquisa;
DROP VIEW IF EXISTS vw_emissao;
DROP TABLE IF EXISTS emissao;
DROP TABLE IF EXISTS pais;
DROP TABLE IF EXISTS pesquisa_resposta;
DROP TABLE IF EXISTS acao_melhoria;
DROP TABLE IF EXISTS meta_indicador;

CREATE TABLE pais (
  iso_code     VARCHAR(8)   NOT NULL PRIMARY KEY,   -- código ISO 3166-1 alfa-3 (OWID_WRL = Mundo)
  nome_en      VARCHAR(80)  NOT NULL,               -- nome original na base
  nome_pt      VARCHAR(80)  NOT NULL,               -- nome em português
  eh_agregado  TINYINT(1)   NOT NULL DEFAULT 0
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

-- Carga dos dados tratados
LOAD DATA LOCAL INFILE 'dados_tratados/pais.csv'
INTO TABLE pais
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(iso_code, nome_en, nome_pt, eh_agregado);

LOAD DATA LOCAL INFILE 'dados_tratados/emissao.csv'
INTO TABLE emissao
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(iso_code, ano, @populacao, @pib, @co2_mt, @co2_per_capita, @co2_por_pib, @co2_petroleo, @participacao_mundial, @renovaveis_eletr)
SET populacao = NULLIF(@populacao, ''),
    pib = NULLIF(@pib, ''),
    co2_mt = NULLIF(@co2_mt, ''),
    co2_per_capita = NULLIF(@co2_per_capita, ''),
    co2_por_pib = NULLIF(@co2_por_pib, ''),
    co2_petroleo = NULLIF(@co2_petroleo, ''),
    participacao_mundial = NULLIF(@participacao_mundial, ''),
    renovaveis_eletr = NULLIF(@renovaveis_eletr, '');

LOAD DATA LOCAL INFILE 'dados_tratados/pesquisa_resposta.csv'
INTO TABLE pesquisa_resposta
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(id_resposta, inicio, conclusao, separacao_residuos, coleta_seletiva, controle_agua, controle_energia, descarte_perigosos, acoes_sustentabilidade, orientacao_ambiental, desperdicio_visivel, reaproveitamento, organizacao_processos, usa_ferramenta_qualidade, @ferramenta_citada, visao_qualidade)
SET ferramenta_citada = NULLIF(@ferramenta_citada, '');

LOAD DATA LOCAL INFILE 'dados_tratados/acao_melhoria.csv'
INTO TABLE acao_melhoria
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(id_acao, problema, evidencia, iso_9001, iso_14001, proposta, responsavel, prazo, custo);

LOAD DATA LOCAL INFILE 'dados_tratados/meta_indicador.csv'
INTO TABLE meta_indicador
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(id_meta, indicador, atual, meta, unidade, medicao);

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

-- Conferência da carga
SELECT 'pais' AS tabela, COUNT(*) AS linhas FROM pais
UNION ALL SELECT 'emissao', COUNT(*) FROM emissao
UNION ALL SELECT 'pesquisa_resposta', COUNT(*) FROM pesquisa_resposta
UNION ALL SELECT 'acao_melhoria', COUNT(*) FROM acao_melhoria
UNION ALL SELECT 'meta_indicador', COUNT(*) FROM meta_indicador;
