"""
Exporta todos os dados tratados do projeto para CSV e monta um banco a partir deles.

Etapas:
  1) lê o banco gerado pelo ETL (app/data/projeto_ods.sqlite);
  2) grava um CSV por tabela e por visão em dados_tratados/;
  3) recria um banco SQLite só com esses CSVs (database/projeto_ods_tratado.sqlite),
     para provar que os arquivos bastam para reconstruir o banco;
  4) confere se as contagens e os totais são iguais nos dois bancos.

Uso (na raiz do repositório, depois de database/etl/gerar_banco.py):
    python database/etl/exportar_csv.py

Formato dos CSV: UTF-8, separador vírgula, ponto como separador decimal,
primeira linha com os nomes das colunas e campo vazio para valor nulo.
"""
import csv
import sqlite3
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ORIGEM = RAIZ / "app" / "data" / "projeto_ods.sqlite"
PASTA = RAIZ / "dados_tratados"
DESTINO = RAIZ / "database" / "projeto_ods_tratado.sqlite"

# Tabelas na ordem de carga (pais antes de emissao, por causa da chave estrangeira)
TABELAS = ["pais", "emissao", "pesquisa_resposta", "acao_melhoria", "meta_indicador"]

# Recortes usados nas análises (gerados a partir das tabelas)
RECORTES = {
    "vw_indices_pesquisa": "SELECT * FROM vw_indices_pesquisa ORDER BY id_resposta",
    "brasil_1990_2022": """
        SELECT ano, populacao, pib, co2_mt, co2_per_capita, co2_por_pib, co2_petroleo,
               participacao_mundial, renovaveis_eletr
        FROM emissao WHERE iso_code = 'BRA' ORDER BY ano""",
    "paises_2022": """
        SELECT p.iso_code, p.nome_pt, e.populacao, e.co2_mt, e.co2_per_capita,
               e.participacao_mundial,
               RANK() OVER (ORDER BY e.co2_mt DESC) AS posicao_em_volume
        FROM emissao e JOIN pais p ON p.iso_code = e.iso_code
        WHERE e.ano = 2022 AND p.eh_agregado = 0 AND e.co2_per_capita IS NOT NULL
        ORDER BY e.co2_mt DESC""",
}


def exportar(con, nome, sql):
    cur = con.execute(sql)
    colunas = [c[0] for c in cur.description]
    linhas = cur.fetchall()
    with open(PASTA / f"{nome}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(colunas)
        w.writerows(["" if v is None else v for v in l] for l in linhas)
    return len(linhas)


def main():
    PASTA.mkdir(exist_ok=True)
    origem = sqlite3.connect(ORIGEM)

    print("Exportando CSV:")
    for t in TABELAS:
        print(f"  {t}.csv: {exportar(origem, t, f'SELECT * FROM {t}')} linhas")
    for nome, sql in RECORTES.items():
        print(f"  {nome}.csv: {exportar(origem, nome, sql)} linhas")

    # Recria o banco a partir dos CSV, com o mesmo modelo (DDL e visões do banco original)
    DESTINO.unlink(missing_ok=True)
    destino = sqlite3.connect(DESTINO)
    for (ddl,) in origem.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL ORDER BY rowid"):
        destino.execute(ddl)
    for t in TABELAS:
        with open(PASTA / f"{t}.csv", encoding="utf-8") as f:
            leitor = csv.reader(f)
            colunas = next(leitor)
            linhas = [[None if v == "" else v for v in l] for l in leitor]
        destino.executemany(f"INSERT INTO {t} ({', '.join(colunas)}) VALUES ({', '.join('?' * len(colunas))})", linhas)
    for (ddl,) in origem.execute("SELECT sql FROM sqlite_master WHERE type = 'view' ORDER BY rowid"):
        destino.execute(ddl)
    destino.commit()

    # Conferência: contagens e somas iguais nos dois bancos
    checagens = [f"SELECT COUNT(*) FROM {t}" for t in TABELAS] + [
        "SELECT ROUND(SUM(co2_mt), 3) FROM emissao",
        "SELECT ROUND(SUM(co2_por_pib), 3) FROM emissao WHERE iso_code = 'BRA'",
        "SELECT ROUND(AVG(ipa), 3) FROM vw_indices_pesquisa",
    ]
    for sql in checagens:
        a, b = origem.execute(sql).fetchone()[0], destino.execute(sql).fetchone()[0]
        assert a == b or abs(float(a) - float(b)) < 1e-6, f"Diferença em: {sql} ({a} x {b})"
    destino.execute("VACUUM")
    destino.close()
    print(f"Banco reconstruído a partir dos CSV: {DESTINO.relative_to(RAIZ)} (conferência OK)")


if __name__ == "__main__":
    main()
