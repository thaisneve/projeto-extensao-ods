-- =============================================================================
-- Índice de alerta de emissões por país (dados derivados do próprio banco)
-- Funciona no SQLite 3.25+ e no MySQL 8 / MariaDB 10.2+ (funções de janela).
--
-- Objetivo: apontar quais países tendem a ter problemas de emissões no futuro,
-- combinando quatro sinais com pesos diferentes:
--   35%  tendência: variação das emissões entre 2012 e 2022 (crescer é pior)
--   25%  emissões por habitante em 2022
--   25%  intensidade de carbono em 2022 (CO2 por PIB, indicador 9.4.1 dos ODS)
--   15%  dependência de petróleo: parte do CO2 que vem do petróleo em 2022
-- Cada sinal vira uma nota de 0 a 100 pela posição do país entre os demais
-- (PERCENT_RANK). O índice é a média ponderada das notas:
--   70 ou mais = alerta alto | 40 a 69,9 = moderado | abaixo de 40 = baixo.
-- Também calcula uma projeção simples das emissões em 2030, pela reta
-- (mínimos quadrados) das emissões de 2012 a 2022.
-- Entram países com pelo menos 1 milhão de habitantes e dados completos.
-- =============================================================================
DROP TABLE IF EXISTS indice_alerta;

CREATE TABLE indice_alerta AS
SELECT n.*,
       CASE WHEN n.indice_alerta >= 70 THEN 'Alto'
            WHEN n.indice_alerta >= 40 THEN 'Moderado'
            ELSE 'Baixo' END AS nivel_alerta,
       RANK() OVER (ORDER BY n.indice_alerta DESC) AS posicao_alerta
FROM (
  SELECT s.iso_code, s.nome_pt, s.populacao, s.co2_2012, s.co2_2022,
         ROUND(s.var_10anos, 2)                     AS variacao_10anos_pct,
         s.co2_per_capita, s.co2_por_pib,
         ROUND(s.dep_petroleo * 100, 2)             AS dependencia_petroleo_pct,
         ROUND(s.co2_2022 + s.inclinacao * 8, 3)    AS projecao_co2_2030,
         ROUND(s.nota_tendencia, 1)                 AS nota_tendencia,
         ROUND(s.nota_per_capita, 1)                AS nota_per_capita,
         ROUND(s.nota_intensidade, 1)               AS nota_intensidade,
         ROUND(s.nota_petroleo, 1)                  AS nota_petroleo,
         ROUND(0.35 * s.nota_tendencia + 0.25 * s.nota_per_capita
             + 0.25 * s.nota_intensidade + 0.15 * s.nota_petroleo, 1) AS indice_alerta
  FROM (
    SELECT b.*, t.inclinacao,
           100 * PERCENT_RANK() OVER (ORDER BY b.var_10anos)     AS nota_tendencia,
           100 * PERCENT_RANK() OVER (ORDER BY b.co2_per_capita) AS nota_per_capita,
           100 * PERCENT_RANK() OVER (ORDER BY b.co2_por_pib)    AS nota_intensidade,
           100 * PERCENT_RANK() OVER (ORDER BY b.dep_petroleo)   AS nota_petroleo
    FROM (
      SELECT p.iso_code, p.nome_pt, e22.populacao,
             e12.co2_mt AS co2_2012, e22.co2_mt AS co2_2022,
             e22.co2_per_capita, e22.co2_por_pib,
             1.0 * e22.co2_petroleo / e22.co2_mt        AS dep_petroleo,
             (1.0 * e22.co2_mt / e12.co2_mt - 1) * 100  AS var_10anos
      FROM pais p
      JOIN emissao e22 ON e22.iso_code = p.iso_code AND e22.ano = 2022
      JOIN emissao e12 ON e12.iso_code = p.iso_code AND e12.ano = 2012
      WHERE p.eh_agregado = 0
        AND e22.populacao >= 1000000
        AND e12.co2_mt > 0 AND e22.co2_mt > 0
        AND e22.co2_por_pib IS NOT NULL
        AND e22.co2_petroleo IS NOT NULL
    ) b
    JOIN (
      -- inclinação da reta das emissões de 2012 a 2022 (Mt por ano)
      SELECT iso_code,
             (COUNT(*) * SUM(ano * co2_mt) - SUM(ano) * SUM(co2_mt))
           / (COUNT(*) * SUM(ano * ano) - SUM(ano) * SUM(ano)) AS inclinacao
      FROM emissao
      WHERE ano BETWEEN 2012 AND 2022 AND co2_mt IS NOT NULL
      GROUP BY iso_code
      HAVING COUNT(*) = 11
    ) t ON t.iso_code = b.iso_code
  ) s
) n;
