# Banco de dados – documentação

Banco **projeto_ods_mpv**, usado pela aplicação web (arquivo SQLite `app/data/projeto_ods.sqlite`) e entregue também como script MySQL 8 / MariaDB (`mysql/projeto_ods_mpv.sql`). Os dois são gerados pelo mesmo ETL, a partir do mesmo modelo.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `etl/gerar_banco.py` | Lê os dados brutos, limpa, traduz os nomes dos países e grava o SQLite e o script MySQL |
| `mysql/projeto_ods_mpv.sql` | Cria o banco, as tabelas, as visões e carrega todos os dados |
| `mysql/consultas_analise.sql` | Consultas de estatística descritiva, frequência, regressão, desigualdade, pesquisa e metas |
| `mysql/resultado_consultas.txt` | Saída das consultas executadas no MariaDB, para conferência |

## Como executar

```bash
python database/etl/gerar_banco.py                 # regenera SQLite e MySQL
mysql -u root < database/mysql/projeto_ods_mpv.sql  # cria e carrega o banco
mysql -u root -t < database/mysql/consultas_analise.sql
```

## Modelo (diagrama simplificado)

```
pais (1) ────────< emissao (N)          pesquisa_resposta ──> vw_indices_pesquisa
  iso_code PK        iso_code FK, ano     id_resposta PK
                     PK (iso_code, ano)
acao_melhoria (id_acao PK)     meta_indicador (id_meta PK)
vw_emissao = emissao + pais
```

## Dicionário de dados

### pais
| Coluna | Tipo | Nulo | Descrição |
|---|---|---|---|
| iso_code | VARCHAR(8) | não | Código ISO 3166-1 alfa-3; `OWID_WRL` representa o Mundo (chave primária) |
| nome_en | VARCHAR(80) | não | Nome original na base do Our World in Data |
| nome_pt | VARCHAR(80) | não | Nome em português |
| eh_agregado | TINYINT(1) | não | 1 para o Mundo; 0 para países |

### emissao
| Coluna | Tipo | Nulo | Unidade | Descrição |
|---|---|---|---|---|
| iso_code | VARCHAR(8) | não | – | País (chave estrangeira para `pais`) |
| ano | SMALLINT | não | – | Ano, de 1990 a 2022 |
| populacao | BIGINT | sim | habitantes | População |
| pib | DOUBLE | sim | int-$ de 2011 | PIB em paridade de poder de compra (Maddison Project Database) |
| co2_mt | DECIMAL(10,3) | sim | Mt | Emissões anuais de CO₂ de combustíveis fósseis e indústria (Global Carbon Budget) |
| co2_per_capita | DECIMAL(8,3) | sim | t/habitante | Emissões por habitante |
| co2_por_pib | DECIMAL(6,3) | sim | kg/int-$ | Intensidade de carbono (indicador 9.4.1 dos ODS) |
| co2_petroleo | DECIMAL(10,3) | sim | Mt | Emissões da queima de petróleo |
| participacao_mundial | DECIMAL(6,3) | sim | % | Participação nas emissões mundiais |
| renovaveis_eletr | DECIMAL(6,3) | sim | % | Eletricidade de fontes renováveis (Ember e Energy Institute) |

Chave primária: (`iso_code`, `ano`). 7.276 registros.

### pesquisa_resposta
| Coluna | Tipo | Descrição |
|---|---|---|
| id_resposta | INT | Identificador da resposta anônima (chave primária) |
| inicio, conclusao | VARCHAR(19) | Momento de início e de conclusão do formulário |
| separacao_residuos … visao_qualidade | SMALLINT | Respostas do checklist: 1 = Sim, 0 = Não |
| desperdicio_visivel | SMALLINT | Item negativo: 1 indica que há desperdício |
| ferramenta_citada | VARCHAR(100) | Resposta aberta sobre a ferramenta da qualidade |

### acao_melhoria
| Coluna | Tipo | Descrição |
|---|---|---|
| id_acao | INT | Chave primária |
| problema, evidencia | VARCHAR | Problema do diagnóstico e evidência que o sustenta |
| iso_9001, iso_14001 | VARCHAR(40) | Requisitos das normas que fundamentam a proposta |
| proposta, responsavel, prazo, custo | VARCHAR | Plano de ação (5W2H resumido) |

### meta_indicador
| Coluna | Tipo | Descrição |
|---|---|---|
| id_meta | INT | Chave primária |
| indicador | VARCHAR(120) | Nome do indicador |
| atual, meta | DECIMAL(6,2) | Valor atual e valor desejado |
| unidade | VARCHAR(10) | `%` ou `pontos` |
| medicao | VARCHAR(160) | Como a meta será medida |

### Visões
- **vw_emissao**: `emissao` com `nome_pt` e `eh_agregado`.
- **vw_indices_pesquisa**: IPA (0 a 9) = soma dos 9 itens ambientais favoráveis, com o desperdício invertido; IGQ (0 a 3) = organização + ferramenta + visão.

## Regras do ETL
1. Mantém de 1990 a 2022 (2022 é o último ano com PIB).
2. Exclui agregados regionais (códigos iniciados por `OWID` e linhas sem código), exceto o Mundo.
3. Exclui registros sem emissão de CO₂.
4. Traduz os nomes com `pycountry` e `Babel`, com ajustes para os dois Congos.
5. Converte as respostas da pesquisa para 1/0.
6. Usa `SET NAMES utf8mb4` no MySQL para preservar os acentos.

## Fontes
Our World in Data – *Data on CO₂ and greenhouse gas emissions* e *Data on energy* (CC BY 4.0). Pesquisa própria com jovens aprendizes do Centro de Formação SENAI/Mercedes-Benz (anônima).
