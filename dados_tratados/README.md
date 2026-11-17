# Dados tratados

Todos os dados usados no projeto, já limpos e organizados, em CSV. São os mesmos dados do banco da aplicação (`app/data/projeto_ods.sqlite`) e do script MySQL.

## Arquivos

| Arquivo | Linhas | Conteúdo |
|---|---|---|
| `pais.csv` | 221 | 220 países e o Mundo (`OWID_WRL`), com nome original e em português |
| `emissao.csv` | 7.276 | Dados anuais de 1990 a 2022 por país: população, PIB, CO₂, CO₂ por habitante, intensidade de carbono, CO₂ do petróleo, participação mundial e eletricidade renovável |
| `pesquisa_resposta.csv` | 10 | Respostas anônimas do checklist ambiental e de qualidade (1 = Sim, 0 = Não) |
| `acao_melhoria.csv` | 6 | Propostas de melhoria com requisitos da ISO 9001 e da ISO 14001 |
| `meta_indicador.csv` | 7 | Metas dos resultados esperados |
| `vw_indices_pesquisa.csv` | 10 | Índices por respondente: IPA (0 a 9) e IGQ (0 a 3) |
| `brasil_1990_2022.csv` | 33 | Recorte do Brasil usado na estatística descritiva e na regressão |
| `paises_2022.csv` | 218 | Recorte dos países em 2022, com posição em volume, usado na análise de desigualdade |

## Formato

- Codificação UTF-8, separador vírgula, ponto como separador decimal.
- A primeira linha traz os nomes das colunas.
- Campo vazio significa valor nulo (dado não disponível na fonte).
- Para abrir no Excel em português: **Dados → Obter dados → De Texto/CSV**, escolha a origem **65001: Unicode (UTF-8)** e o delimitador **Vírgula**.

As colunas, tipos e unidades estão descritos no dicionário de dados: [`database/README.md`](../database/README.md).

## Como os dados foram tratados

1. Dados brutos em `analise/dados_brutos/` (Our World in Data e pesquisa no Microsoft Forms).
2. `database/etl/gerar_banco.py` filtra 1990–2022, remove agregados regionais (mantém o Mundo), exclui registros sem CO₂, traduz os nomes dos países e converte as respostas da pesquisa para 1/0.
3. `database/etl/exportar_csv.py` grava estes CSV e reconstrói o banco **só a partir deles** (`database/projeto_ods_tratado.sqlite`), conferindo contagens e somas.

## Banco montado com estes CSV

- **SQLite:** `database/projeto_ods_tratado.sqlite` (abre no DB Browser for SQLite).
- **MySQL 8 / MariaDB:** na raiz do repositório, execute
  `mysql -u root --local-infile=1 < database/mysql/carregar_dados_tratados.sql`
  (no MySQL 8, rode antes `SET GLOBAL local_infile = 1;` como administrador).

## Fontes

- Our World in Data. *Data on CO₂ and greenhouse gas emissions* e *Data on energy* (Global Carbon Budget, Maddison Project Database, Ember e Energy Institute). Licença CC BY 4.0. https://github.com/owid/co2-data e https://github.com/owid/energy-data
- Pesquisa própria com jovens aprendizes do Centro de Formação SENAI/Mercedes-Benz, 2º semestre de 2026 (respostas anônimas).
