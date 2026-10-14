# Tabela "Os números, ano a ano" da aba Evolução (e a série "Commodities (Brasil)" do comparador):
# média anual de 2020 até hoje dos indicadores do CEPEA/ESALQ, calculada das planilhas que o próprio
# CEPEA publica no site. Grava src/historicoCepea.json, que o site lê na hora de ser montado. O ano
# corrente é a média de 1º de janeiro até o último dia publicado. Uma rotina do GitHub
# (.github/workflows/historico-cepea.yml) roda este script uma vez por mês.
# Para rodar à mão: pip install xlrd==2.0.1 e depois python3 scripts/historico-cepea.py
import collections, datetime, json, pathlib, sys, time, urllib.request
import xlrd

SERIES = {  # chave da tabela → (endereço da planilha no CEPEA, nome do indicador, unidade)
    "boi": ("boi-gordo.aspx?id=2", "Indicador do Boi Gordo CEPEA/ESALQ (São Paulo)", "R$/@"),
    "soja": ("soja.aspx?id=12", "Indicador da Soja CEPEA/ESALQ, Paraná", "R$/saca de 60 kg"),
    "milho": ("milho.aspx?id=77", "Indicador do Milho ESALQ/B3 (Campinas)", "R$/saca de 60 kg"),
    "cafe": ("cafe.aspx?id=23", "Indicador do Café Arábica CEPEA/ESALQ", "R$/saca de 60 kg"),
    "trigo": ("trigo.aspx?id=178", "Preço médio do trigo CEPEA/ESALQ, Paraná", "R$/tonelada"),
}
PRIMEIRO_ANO = 2020
UA = "Mozilla/5.0 (compatible; AgroInfo/1.0; +https://agronahora.com.br)"
DESTINO = pathlib.Path(__file__).resolve().parent.parent / "src" / "historicoCepea.json"


def baixar(caminho):
    for tentativa in range(3):
        try:
            pedido = urllib.request.Request(f"https://www.cepea.esalq.usp.br/br/indicador/series/{caminho}", headers={"User-Agent": UA})
            with urllib.request.urlopen(pedido, timeout=90) as resposta:
                return resposta.read()
        except Exception as erro:  # o site às vezes demora: espera e tenta de novo
            print(f"  {caminho}: {erro}", file=sys.stderr)
            time.sleep(10 * (tentativa + 1))
    raise RuntimeError(f"não foi possível baixar {caminho}")


def diarios(conteudo):
    # A planilha tem algumas linhas de título e depois "data | à vista R$ | à vista US$", um dia por linha.
    # O arquivo do CEPEA vem com um defeito de estrutura que o Excel ignora; o xlrd também, com esta opção.
    folha = xlrd.open_workbook(file_contents=conteudo, ignore_workbook_corruption=True).sheet_by_index(0)
    for linha in range(folha.nrows):
        data, valor = folha.cell_value(linha, 0), folha.cell_value(linha, 1)
        if isinstance(data, str) and data.count("/") == 2 and isinstance(valor, float) and valor > 0:
            dia, mes, ano = (int(parte) for parte in data.split("/"))
            yield datetime.date(ano, mes, dia), valor


def main():
    por_ano = collections.defaultdict(dict)  # ano → {chave: média}
    series, ultimo_dia = {}, None
    for chave, (caminho, nome, unidade) in SERIES.items():
        valores = collections.defaultdict(list)
        ultimo = None
        for data, valor in diarios(baixar(caminho)):
            if data.year >= PRIMEIRO_ANO:
                valores[data.year].append(valor)
                if ultimo is None or data > ultimo[0]:
                    ultimo = (data, valor)
        if not valores or ultimo is None:
            raise RuntimeError(f"{chave}: planilha sem dados desde {PRIMEIRO_ANO}")
        for ano, lista in valores.items():
            por_ano[ano][chave] = round(sum(lista) / len(lista), 2)
        series[chave] = {"nome": nome, "unidade": unidade, "ultimo": {"data": ultimo[0].isoformat(), "valor": round(ultimo[1], 2)}}
        ultimo_dia = max(ultimo_dia or ultimo[0], ultimo[0])
        print(f"{chave}: {len(valores)} anos, último dia {ultimo[0]} ({ultimo[1]})")
        time.sleep(2)
    anos = [{"ano": str(ano), **por_ano[ano]} for ano in sorted(por_ano) if all(chave in por_ano[ano] for chave in SERIES)]
    dados = {"fonte": "CEPEA/ESALQ", "ultimoDia": ultimo_dia.isoformat(), "series": series, "anos": anos}
    anterior = json.loads(DESTINO.read_text()) if DESTINO.exists() else None
    if anterior == dados:
        print("Nada mudou.")
        return
    DESTINO.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n")
    print(f"Gravado {DESTINO.name}: {len(anos)} anos, dados até {ultimo_dia}.")


main()
