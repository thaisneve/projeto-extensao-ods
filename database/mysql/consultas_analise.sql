-- =============================================================================
-- Consultas de análise estatística – banco projeto_ods_mpv (MySQL 8 / MariaDB)
-- Execute depois de projeto_ods_mpv.sql
-- =============================================================================
SET NAMES utf8mb4;
USE projeto_ods_mpv;

-- Q1. Medidas descritivas do Brasil, 1990–2022 (CO2 e intensidade de carbono)
SELECT 'co2_mt' AS variavel, COUNT(*) AS n, ROUND(AVG(co2_mt),2) AS media,
       MIN(co2_mt) AS minimo, MAX(co2_mt) AS maximo, ROUND(MAX(co2_mt)-MIN(co2_mt),2) AS amplitude,
       ROUND(VAR_SAMP(co2_mt),2) AS variancia, ROUND(STDDEV_SAMP(co2_mt),2) AS desvio_padrao
FROM emissao WHERE iso_code = 'BRA'
UNION ALL
SELECT 'co2_por_pib', COUNT(*), ROUND(AVG(co2_por_pib),4), MIN(co2_por_pib), MAX(co2_por_pib),
       ROUND(MAX(co2_por_pib)-MIN(co2_por_pib),3), ROUND(VAR_SAMP(co2_por_pib),6), ROUND(STDDEV_SAMP(co2_por_pib),4)
FROM emissao WHERE iso_code = 'BRA';

-- Q2. Mediana das emissões do Brasil
SELECT ROUND(AVG(co2_mt),3) AS mediana_co2
FROM (SELECT co2_mt, ROW_NUMBER() OVER (ORDER BY co2_mt) AS pos, COUNT(*) OVER () AS total
      FROM emissao WHERE iso_code = 'BRA') t
WHERE pos IN (FLOOR((total+1)/2), CEIL((total+1)/2));

-- Q3. Tabela de frequência das emissões do Brasil (Sturges: 6 classes de 56,5 Mt)
SELECT CONCAT(218 + 56.5*cl, ' |- ', 218 + 56.5*(cl+1)) AS classe, COUNT(*) AS fi,
       ROUND(COUNT(*)*100/33,1) AS fr_pct
FROM (SELECT LEAST(FLOOR((co2_mt-218)/56.5),5) AS cl FROM emissao WHERE iso_code = 'BRA') t
GROUP BY cl ORDER BY cl;

-- Q4. Regressão linear simples (Y = CO2 em Mt; X = PIB em trilhões de int-$)
SELECT ROUND(a,4) AS coef_angular_a, ROUND(my - a*mx,4) AS coef_linear_b,
       ROUND(r,4) AS correlacao_r, ROUND(r*r,4) AS r2
FROM (
  SELECT mx, my,
         SUM((pib/1e12-mx)*(co2_mt-my)) / SUM(POW(pib/1e12-mx,2)) AS a,
         SUM((pib/1e12-mx)*(co2_mt-my)) / SQRT(SUM(POW(pib/1e12-mx,2))*SUM(POW(co2_mt-my,2))) AS r
  FROM emissao,
       (SELECT AVG(pib/1e12) AS mx, AVG(co2_mt) AS my FROM emissao WHERE iso_code = 'BRA') m
  WHERE iso_code = 'BRA'
  GROUP BY mx, my
) t;

-- Q5. Distribuição dos países por emissão por habitante em 2022 (classes de 5 t)
SELECT CASE WHEN co2_per_capita >= 30 THEN '30 ou mais'
            ELSE CONCAT(FLOOR(co2_per_capita/5)*5, ' |- ', FLOOR(co2_per_capita/5)*5+5) END AS classe_t_hab,
       COUNT(*) AS fi
FROM vw_emissao WHERE ano = 2022 AND eh_agregado = 0 AND co2_per_capita IS NOT NULL
GROUP BY classe_t_hab ORDER BY MIN(co2_per_capita);

-- Q6. Concentração: participação dos 10 maiores emissores em 2022
SELECT ROUND(SUM(co2_mt)*100 / (SELECT SUM(co2_mt) FROM vw_emissao WHERE ano = 2022 AND eh_agregado = 0),1) AS pct_top10
FROM (SELECT co2_mt FROM vw_emissao WHERE ano = 2022 AND eh_agregado = 0 ORDER BY co2_mt DESC LIMIT 10) t;

-- Q7. Ranking 2022 com a posição do Brasil
SELECT nome_pt, co2_mt, co2_per_capita, participacao_mundial,
       RANK() OVER (ORDER BY co2_mt DESC) AS posicao
FROM vw_emissao WHERE ano = 2022 AND eh_agregado = 0
ORDER BY posicao LIMIT 12;

-- Q8. Pesquisa com aprendizes: percentual de "Sim" por pergunta
SELECT ROUND(AVG(separacao_residuos)*100) AS separacao, ROUND(AVG(coleta_seletiva)*100) AS coleta,
       ROUND(AVG(controle_agua)*100) AS agua, ROUND(AVG(controle_energia)*100) AS energia,
       ROUND(AVG(desperdicio_visivel)*100) AS desperdicio, ROUND(AVG(usa_ferramenta_qualidade)*100) AS ferramenta
FROM pesquisa_resposta;

-- Q9. Índices da pesquisa (IPA e IGQ)
SELECT ROUND(AVG(ipa),2) AS ipa_medio, ROUND(STDDEV_SAMP(ipa),3) AS dp_ipa,
       ROUND(AVG(igq),2) AS igq_medio, ROUND(STDDEV_SAMP(igq),3) AS dp_igq
FROM vw_indices_pesquisa;

-- Q10. Metas e propostas de melhoria
SELECT indicador, atual, meta, unidade FROM meta_indicador ORDER BY id_meta;
SELECT id_acao, problema, proposta, prazo FROM acao_melhoria ORDER BY id_acao;

-- =============================================================================
-- ÍNDICE DE ALERTA (tabela indice_alerta, criada por database/indice_alerta.sql)
-- =============================================================================

-- Q11. Os 10 países com maior índice de alerta e o sinal que mais pesa em cada um
SELECT posicao_alerta, nome_pt, indice_alerta, nivel_alerta,
       CASE GREATEST(0.35*nota_tendencia, 0.25*nota_per_capita, 0.25*nota_intensidade, 0.15*nota_petroleo)
            WHEN 0.35*nota_tendencia   THEN 'emissões crescendo'
            WHEN 0.25*nota_per_capita  THEN 'muito CO2 por habitante'
            WHEN 0.25*nota_intensidade THEN 'economia intensiva em carbono'
            ELSE 'dependência de petróleo' END AS principal_sinal
FROM indice_alerta ORDER BY posicao_alerta LIMIT 10;

-- Q12. Quantos países em cada nível de alerta
SELECT nivel_alerta, COUNT(*) AS paises, ROUND(AVG(indice_alerta),1) AS indice_medio
FROM indice_alerta GROUP BY nivel_alerta ORDER BY indice_medio DESC;

-- Q13. Brasil: notas de cada sinal, índice e projeção para 2030
SELECT nome_pt, posicao_alerta, (SELECT COUNT(*) FROM indice_alerta) AS total_paises,
       nota_tendencia, nota_per_capita, nota_intensidade, nota_petroleo,
       indice_alerta, nivel_alerta, co2_2022, projecao_co2_2030
FROM indice_alerta WHERE iso_code = 'BRA';

-- Q14. Países que mais devem aumentar as emissões até 2030 (projeção pela tendência 2012–2022)
SELECT nome_pt, co2_2022, projecao_co2_2030,
       ROUND(projecao_co2_2030 - co2_2022, 1) AS aumento_previsto_mt
FROM indice_alerta ORDER BY aumento_previsto_mt DESC LIMIT 10;

-- Q15. Países que crescem as emissões e já emitem acima da média mundial por habitante
SELECT nome_pt, variacao_10anos_pct, co2_per_capita
FROM indice_alerta
WHERE variacao_10anos_pct > 0
  AND co2_per_capita > (SELECT co2_per_capita FROM emissao WHERE iso_code = 'OWID_WRL' AND ano = 2022)
ORDER BY variacao_10anos_pct DESC;
