# Carbono e riqueza – MPV de relatório estatístico de dados abertos

Projeto de Extensão do 4º semestre do curso de **Informática para Negócios** da **Fatec São Bernardo do Campo – Adib Moisés Dib**, para as disciplinas de **Banco de Dados, Programação, Estatística e Gestão da Qualidade**.

**Autora:** Thais Mendes da Silva

**Aplicação publicada:** https://thaisneve.github.io/projeto-extensao-ods/

---

## O que é

Um site que mostra, com dados públicos, se o Brasil está conseguindo crescer a economia emitindo menos CO₂. Ele também traz uma pesquisa feita com jovens aprendizes sobre qualidade e meio ambiente, com propostas de melhoria. Todos os números saem de consultas SQL a um banco de dados que roda no próprio navegador.

O site está dividido assim:

- **Brasil:** de 1990 a 2022 o PIB subiu 168,9% e as emissões de CO₂ subiram 119,8%. Por isso, cada dólar produzido passou a emitir 17,9% menos carbono (indicador 9.4.1 dos ODS). O pico das emissões foi em 2014.
- **Mundo, em volume:** os 10 maiores emissores somam 70,5% do CO₂; o Brasil é o 12º, com 1,3% do total.
- **Mundo, por habitante:** o brasileiro emite 2,29 t por ano, menos da metade da média mundial (4,67 t).
- **PIB e CO₂:** regressão linear ŷ = 136,58x + 76,88 (r = 0,976) e um simulador de cenários.
- **Índice de alerta:** nota de 0 a 100 que aponta quais países tendem a ter problemas para cumprir metas de emissão (detalhes abaixo).
- **Comparar:** o Brasil ao lado de outro país, em quatro indicadores, com tabela, CSV e link.
- **Qualidade na prática:** pesquisa com 10 jovens aprendizes do Centro de Formação SENAI/Mercedes-Benz, seis propostas baseadas na ISO 9001 e na ISO 14001 e metas.
- **Consultas:** consultas prontas ao banco, escolhidas por filtros.

## Consultar o banco de dados

- **No site:** a seção **Consultas** oferece consultas prontas (série histórica de um país, ranking por indicador, países por nível de alerta, respostas da pesquisa e propostas). O usuário só escolhe opções em listas; cada valor é conferido contra a lista permitida e enviado ao banco como parâmetro, nunca colado no texto do SQL. Não existe campo para digitar SQL, o que elimina o risco de injeção de SQL. O site mostra a consulta executada, os parâmetros e a lista de tabelas e colunas.
- **No computador:** baixe `app/data/projeto_ods.sqlite` e abra no [DB Browser for SQLite](https://sqlitebrowser.org/) (aba *Executar SQL*).
- **No MySQL:** execute `database/mysql/projeto_ods_mpv.sql` no MySQL Workbench e use as consultas de `database/mysql/consultas_analise.sql`.

## Estrutura do repositório

```
app/                      Aplicação web (front-end) publicada no GitHub Pages
  index.html              Página única com os capítulos do relatório
  css/style.css           Estilos (leis da UX comentadas no código)
  js/app.js               Consultas SQL, estatística e gráficos
  data/projeto_ods.sqlite Banco de dados consultado no navegador
  vendor/                 sql.js (SQLite em WebAssembly) e Chart.js
dados_tratados/           Todos os dados tratados em CSV (um arquivo por tabela e recortes das análises)
database/
  etl/gerar_banco.py      ETL: gera o SQLite e o script MySQL a partir dos dados brutos
  etl/exportar_csv.py     Exporta os CSV tratados e reconstrói o banco a partir deles
  indice_alerta.sql       Cria a tabela do índice de alerta (SQLite e MySQL)
  projeto_ods_tratado.sqlite     Banco SQLite montado só com os CSV tratados
  mysql/carregar_dados_tratados.sql  Cria o banco no MySQL e carrega os CSV (LOAD DATA)
  mysql/projeto_ods_mpv.sql      Script MySQL documentado (criação e carga)
  mysql/consultas_analise.sql    Consultas de estatística descritiva, frequência e regressão
  mysql/resultado_consultas.txt  Saída das consultas executadas no MariaDB
analise/
  analise_dados_abertos.py       Estatística e gráficos dos dados abertos (Python)
  analise_pesquisa_aprendizes.py Estatística da pesquisa com aprendizes
  gerar_planilha_dashboard.py    Gera a planilha inteligente com dashboard (Excel)
  dados_brutos/                  CSVs do Our World in Data e da pesquisa (anônima)
  saida/                         Gráficos e resultados gerados
docs/                     Planilha inteligente com dashboard (Excel)
.github/workflows/pages.yml  Publicação automática da pasta app/
```

## Como executar

**Aplicação web (local):**

```bash
cd app
python -m http.server 8000
# abra http://localhost:8000
```

A página precisa ser aberta por um servidor (local ou GitHub Pages), porque o navegador bloqueia o carregamento do banco quando o arquivo é aberto direto.

**Regerar o banco de dados e os CSV tratados:**

```bash
pip install -r requirements.txt
python database/etl/gerar_banco.py
python database/etl/exportar_csv.py
```

**Carregar no MySQL 8 / MariaDB e rodar as análises:**

```bash
mysql -u root < database/mysql/projeto_ods_mpv.sql
mysql -u root -t < database/mysql/consultas_analise.sql
```

## Índice de alerta: conclusão prática

Para transformar os dados em orientação, o banco calcula a tabela `indice_alerta` (arquivo `database/indice_alerta.sql`, que roda igual no SQLite e no MySQL 8). Para 153 países com pelo menos 1 milhão de habitantes, ela combina quatro sinais:

| Sinal | Peso | Por quê |
|---|---|---|
| Variação das emissões de 2012 a 2022 | 35% | quem ainda está aumentando tem mais dificuldade de cumprir metas |
| CO₂ por habitante em 2022 | 25% | consumo alto de energia fóssil por pessoa |
| Intensidade de carbono em 2022 | 25% | economia que depende muito de carbono para gerar riqueza |
| Parcela do CO₂ que vem do petróleo | 15% | dependência de combustíveis, difícil de trocar rápido |

Cada sinal vira uma nota de 0 a 100 pela posição do país entre os demais (`PERCENT_RANK`). O índice é a média ponderada das notas: 70 ou mais é alerta alto, de 40 a 69,9 é moderado e abaixo de 40 é baixo. A mesma tabela traz uma projeção para 2030 pela reta de mínimos quadrados de 2012 a 2022, calculada no próprio SQL.

Resultado: 9 países em alerta alto, 119 moderado e 25 baixo. O Brasil fica com 41,3 (moderado, 127º de 153). As emissões caíram nos últimos dez anos e a intensidade é baixa, mas a nota de dependência de petróleo é 69,1. A orientação é priorizar transporte e combustíveis. As consultas Q11 a Q15 de `database/mysql/consultas_analise.sql` exploram o índice.

## Planilha inteligente com dashboard

`docs/Planilha_Inteligente_Dashboard_ODS.xlsx` (também baixável no fim da aplicação) traz o dashboard com quatro indicadores, comparador por país, simulador, resumo da pesquisa e gráficos, além das abas de dados, estatística, regressão, pesquisa e metas. Todos os resultados são fórmulas e recalculam sozinhos. Para gerar de novo: `python analise/gerar_planilha_dashboard.py`.

## Modelo de dados

| Tabela | Conteúdo | Chave |
|---|---|---|
| `pais` | 220 países e o agregado Mundo, com nome em português | `iso_code` |
| `emissao` | Fato anual 1990–2022: população, PIB, CO₂, CO₂ por habitante, intensidade de carbono, CO₂ do petróleo, participação mundial, % de eletricidade renovável | `iso_code, ano` |
| `pesquisa_resposta` | 10 respostas anônimas do checklist ambiental e de qualidade (1 = Sim) | `id_resposta` |
| `acao_melhoria` | Propostas de melhoria com requisitos da ISO 9001 e da ISO 14001 | `id_acao` |
| `meta_indicador` | Metas dos resultados esperados | `id_meta` |
| `indice_alerta` | Índice de alerta por país, notas dos quatro sinais e projeção para 2030 (dado derivado) | `iso_code` |

Visões: `vw_emissao` (emissões com nome do país) e `vw_indices_pesquisa` (IPA e IGQ por respondente). O dicionário de dados completo está em [`database/README.md`](database/README.md).

## Storytelling com dados e leis da UX

- **Storytelling com dados:** títulos que afirmam a conclusão do gráfico, um gráfico por mensagem, cor só onde importa (o Brasil em verde, o resto em cinza), rótulos diretos no lugar de legendas, eliminação de bordas e grades desnecessárias e uma narrativa com começo (contexto), meio (tensão: desigualdade e dependência do PIB) e fim (o que fazer).
- **Leis da UX aplicadas:** Jakob (layout conhecido), Hick (poucos itens no menu e quatro opções de indicador), Miller (até quatro números por grupo), Fitts (alvos de pelo menos 44 px), Von Restorff (Brasil destacado), proximidade e região comum da Gestalt (rótulo colado ao número), limiar de Doherty (consultas locais em menos de 400 ms) e regra do pico-final (fechamento com chamada à ação).

## Fontes dos dados

- Our World in Data. *Data on CO₂ and greenhouse gas emissions* e *Data on energy* (Global Carbon Budget, Maddison Project Database, Energy Institute e Ember). Licença CC BY 4.0. https://github.com/owid/co2-data
- Pesquisa própria com jovens aprendizes do Centro de Formação SENAI/Mercedes-Benz, São Bernardo do Campo, 2º semestre de 2026 (respostas anônimas).

## Licença

Código sob licença MIT. Os dados do Our World in Data mantêm a licença CC BY 4.0.
