# Carbono e riqueza – MPV de relatório estatístico de dados abertos

Projeto de Extensão do 4º semestre do curso de **Informática para Negócios** da **Fatec São Bernardo do Campo – Adib Moisés Dib**, para as disciplinas de **Banco de Dados, Programação, Estatística e Gestão da Qualidade**.

**Autora:** Thais Mendes da Silva

**Aplicação publicada:** https://thaisneve.github.io/projeto-extensao-ods/ (depois de ativar o GitHub Pages, veja abaixo)

---

## O que é

Um Mínimo Produto Viável (MPV) de relatório estatístico, aberto à comunidade, que usa **dados abertos sobre meio ambiente** e um **diagnóstico de gestão da qualidade** para apoiar decisões. A aplicação conta uma história em quatro capítulos:

1. **Brasil:** as emissões de CO₂ subiram 119,8% entre 1990 e 2022, mas o PIB subiu 168,9%. A intensidade de carbono (indicador 9.4.1 dos ODS) caiu 17,9%.
2. **Mundo:** os 10 maiores emissores somam 70,5% do CO₂. O Brasil é o 12º em volume, mas emite 2,29 t por habitante, menos da metade da média mundial (4,67 t).
3. **PIB e CO₂:** regressão linear ŷ = 136,58x + 76,88 (r = 0,976), com um simulador de cenários.
4. **Qualidade na prática:** pesquisa com jovens aprendizes do Centro de Formação SENAI/Mercedes-Benz, seis propostas de melhoria baseadas na ISO 9001 e na ISO 14001 e metas.

Logo abaixo da manchete, um **painel-resumo** mostra os quatro números principais. O **comparador** permite escolher um país (ou usar os atalhos) e um indicador, ver os dados em tabela, baixar em CSV, copiar um link que abre a mesma comparação e conferir a consulta SQL executada.

## Consultar o banco de dados

- **No site:** a seção **Banco de dados** tem um console em que qualquer pessoa digita um `SELECT` e vê o resultado na hora, com exemplos prontos e a lista de tabelas e colunas.
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
  fonts/                  Archivo e Source Serif 4 (licença OFL)
dados_tratados/           Todos os dados tratados em CSV (um arquivo por tabela e recortes das análises)
database/
  etl/gerar_banco.py      ETL: gera o SQLite e o script MySQL a partir dos dados brutos
  etl/exportar_csv.py     Exporta os CSV tratados e reconstrói o banco a partir deles
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
docs/                     Documento centralizado, artigo, relatórios (Word e PDF) e planilha com dashboard (Excel)
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

## Publicar no GitHub Pages

1. No repositório, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Faça um push na branch `main` (ou rode o workflow manualmente em **Actions**). O endereço aparece em Settings → Pages.

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

Visões: `vw_emissao` (emissões com nome do país) e `vw_indices_pesquisa` (IPA e IGQ por respondente). O dicionário de dados completo está em [`database/README.md`](database/README.md).

## Storytelling com dados e leis da UX

- **Storytelling com dados:** títulos que afirmam a conclusão do gráfico, um gráfico por mensagem, cor só onde importa (o Brasil em verde, o resto em cinza), rótulos diretos no lugar de legendas, eliminação de bordas e grades desnecessárias e uma narrativa com começo (contexto), meio (tensão: desigualdade e dependência do PIB) e fim (o que fazer).
- **Leis da UX aplicadas:** Jakob (layout conhecido), Hick (cinco itens no menu e três opções de indicador), Miller (até quatro números por grupo), Fitts (alvos de pelo menos 44 px), Von Restorff (Brasil destacado), proximidade e região comum da Gestalt (rótulo colado ao número), limiar de Doherty (consultas locais em menos de 400 ms) e regra do pico-final (fechamento com chamada à ação).

## Fontes dos dados

- Our World in Data. *Data on CO₂ and greenhouse gas emissions* e *Data on energy* (Global Carbon Budget, Maddison Project Database, Energy Institute e Ember). Licença CC BY 4.0. https://github.com/owid/co2-data
- Pesquisa própria com jovens aprendizes do Centro de Formação SENAI/Mercedes-Benz, São Bernardo do Campo, 2º semestre de 2026 (respostas anônimas).

## Licença

Código sob licença MIT. Os dados do Our World in Data mantêm a licença CC BY 4.0.
