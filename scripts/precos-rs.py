# Aba "Cotações Cooperativas", Rio Grande do Sul: preços recebidos pelos produtores gaúchos, do boletim
# semanal "Cotações Agropecuárias" da Emater/RS-Ascar (um PDF por semana, publicado às quintas). Lê do PDF
# o resumo do estado (mínimo, médio e máximo), a comparação com a semana, o mês e o ano anteriores e a
# tabela por município, e grava public/dados/precos-rs.json, que a aba lê. Uma rotina do GitHub
# (.github/workflows/precos-rs.yml) roda este script todo dia e só publica quando sai boletim novo.
# Para rodar à mão: pip install pypdf==6.19.0 e depois python3 scripts/precos-rs.py
# (ou, para testar um PDF já baixado: python3 scripts/precos-rs.py --pdf arquivo.pdf --saida teste.json)
import argparse, datetime, io, json, pathlib, re, sys, time, urllib.request
from pypdf import PdfReader

PAGINA = "https://www.emater.tche.br/site/info-agro/precos_semanais.php"
UA = "Mozilla/5.0 (compatible; AgroInfo/1.0; +https://agronahora.com.br)"
DESTINO = pathlib.Path(__file__).resolve().parent.parent / "public" / "dados" / "precos-rs.json"
NUM = r"\d{1,3}(?:\.\d{3})*,\d{2}"
UNIDADE = r"\d+\s*kg|kg vivo|kg|litro|l|dúzia|cabeça|t"


def baixar(endereco):
    for tentativa in range(3):
        try:
            pedido = urllib.request.Request(endereco, headers={"User-Agent": UA})
            with urllib.request.urlopen(pedido, timeout=90) as resposta:
                return resposta.read()
        except Exception as erro:  # o site às vezes demora: espera e tenta de novo
            print(f"  {endereco}: {erro}", file=sys.stderr)
            time.sleep(10 * (tentativa + 1))
    raise RuntimeError(f"não foi possível baixar {endereco}")


def numero(texto):
    return float(texto.replace(".", "").replace(",", "."))


def ultimo_boletim():
    # a página lista os PDFs das últimas semanas: preco_DDMMAAAA.pdf; vale o de data mais recente
    pagina = baixar(PAGINA).decode("utf-8", "replace")
    achados = set(re.findall(r"arquivos_pdf/precos/preco_(\d{2})(\d{2})(\d{4})\.pdf", pagina))
    if not achados:
        raise RuntimeError("a página da Emater não trouxe nenhum boletim de preços")
    dia, mes, ano = max(achados, key=lambda d: (d[2], d[1], d[0]))
    return f"https://www.emater.tche.br/site/arquivos_pdf/precos/preco_{dia}{mes}{ano}.pdf"


def resumo(texto):
    # página 1: "Soja 60 kg 136,00 138,32 147,00" (produto, unidade, mínimo, médio, máximo)
    produtos = {}
    for linha in texto.splitlines():
        m = re.match(rf"^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]*?)\s+({UNIDADE})\s+({NUM})\s+({NUM})\s+({NUM})\s*$", linha, re.I)
        if m:
            nome = m.group(1).strip()
            produtos[nome] = {"nome": nome, "unidade": re.sub(r"\s+", " ", m.group(2)),
                              "minimo": numero(m.group(3)), "medio": numero(m.group(4)), "maximo": numero(m.group(5))}
    return produtos


def comparacao(texto, produtos):
    # página 2: atual, semana anterior, mês anterior, ano anterior (corrigido pelo IGP-DI) e médias históricas
    datas = re.search(r"(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})", texto)
    for linha in texto.splitlines():
        m = re.match(rf"^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]*?)\s+(?:{UNIDADE})\s+({NUM})\s+({NUM})\s+({NUM})\s+({NUM})", linha, re.I)
        if m and m.group(1).strip() in produtos:
            p = produtos[m.group(1).strip()]
            p["semanaAnterior"], p["mesAnterior"], p["anoAnterior"] = numero(m.group(3)), numero(m.group(4)), numero(m.group(5))
    return {"semanaAnterior": datas.group(2), "mesAnterior": datas.group(3), "anoAnterior": datas.group(4)} if datas else None


LINHA_DE_DADOS = re.compile(r"^\s*([A-Za-zÀ-ÿ'][A-Za-zÀ-ÿ' .-]*?)\s{2,}(?=\d)")
RESUMOS = {"mínimo", "média", "máximo", "media", "minimo", "maximo"}  # linhas do fim da tabela, não são municípios


def municipios(pagina, produtos):
    # Tabela por município: com o texto "em layout" cada preço fica embaixo da coluna do seu produto.
    # O cabeçalho ocupa algumas linhas em volta de "Municípios" (nome do produto numa, unidade entre
    # parênteses em outra, e às vezes um produto com nome e unidade em linhas próprias, como o leite).
    # Cada nome se junta à unidade mais próxima, e a coluna fica no centro da unidade, que é onde os
    # preços se alinham. Retorna {produto: [{nome, valor}]} e quantos valores ficaram fora da faixa.
    linhas = pagina.extract_text(extraction_mode="layout").splitlines()
    i_mun = next((i for i, l in enumerate(linhas) if "Municípios" in l), None)
    if i_mun is None:
        return {}, 0
    inicio = next((i for i in range(i_mun + 1, len(linhas)) if LINHA_DE_DADOS.match(linhas[i])), len(linhas))
    nomes, unidades = [], []
    for linha in linhas[max(0, i_mun - 3):inicio]:
        for m in re.finditer(r"\([^)]*\)", linha):
            unidades.append((m.start() + m.end()) / 2)
        sem_unidades = re.sub(r"\([^)]*\)", lambda m: " " * len(m.group(0)), linha)
        for m in re.finditer(r"[A-Za-zÀ-ÿ]+(?: [A-Za-zÀ-ÿ]+)*", sem_unidades):
            if m.group(0) in produtos:  # só nomes do resumo do boletim (o título da página fica de fora)
                nomes.append((m.group(0), (m.start() + m.end()) / 2))
    if not nomes:
        return {}, 0
    colunas = [(nome, min(unidades, key=lambda u: abs(u - centro)) if unidades else centro) for nome, centro in nomes]
    achados, fora = {}, 0
    for linha in linhas[inicio:]:
        m = LINHA_DE_DADOS.match(linha)
        if not m or m.group(1).strip().lower() in RESUMOS:
            continue
        municipio = m.group(1).strip()
        for v in re.finditer(NUM, linha):
            centro = (v.start() + v.end()) / 2
            produto = min(colunas, key=lambda c: abs(c[1] - centro))[0]
            valor = numero(v.group(0))
            faixa = produtos.get(produto)
            # conferência: o preço de um município está entre o mínimo e o máximo do estado
            if not faixa or not (faixa["minimo"] - 0.01 <= valor <= faixa["maximo"] + 0.01):
                fora += 1
                continue
            achados.setdefault(produto, []).append({"nome": municipio, "valor": valor})
    return achados, fora


def ler(conteudo, endereco):
    leitor = PdfReader(io.BytesIO(conteudo))
    primeira = leitor.pages[0].extract_text()
    produtos = resumo(primeira)
    if len(produtos) < 3:
        raise RuntimeError("o resumo do boletim não está no formato esperado")
    boletim = re.search(r"nº\s*(\d+)", primeira)
    semana = re.search(r"Semana de (\d{2}/\d{2}/\d{4}) a (\d{2}/\d{2}/\d{4})", primeira)
    datas = comparacao(leitor.pages[1].extract_text(), produtos) if len(leitor.pages) > 1 else None
    total, fora = 0, 0
    for pagina in leitor.pages[2:]:
        if "POR MUNIC" not in (pagina.extract_text() or ""):
            continue
        achados, f = municipios(pagina, produtos)
        fora += f
        for produto, lista in achados.items():
            produtos[produto].setdefault("municipios", []).extend(lista)
            total += len(lista)
    if fora > max(3, total * 0.1):  # muita coisa fora da faixa: a leitura das colunas falhou; fica só o resumo
        print(f"  tabela por município descartada: {fora} valores fora da faixa, {total} dentro", file=sys.stderr)
        for p in produtos.values():
            p.pop("municipios", None)
    elif fora:
        print(f"  {fora} valores fora da faixa descartados ({total} dentro)", file=sys.stderr)
    for p in produtos.values():
        p.get("municipios", []).sort(key=lambda m: m["nome"])
    return {
        "fonte": "Emater/RS-Ascar, Cotações Agropecuárias",
        "boletim": int(boletim.group(1)) if boletim else None,
        "semana": {"de": semana.group(1), "ate": semana.group(2)} if semana else None,
        "comparacao": datas,
        "pdf": endereco,
        "pagina": PAGINA,
        "geradoEm": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "produtos": list(produtos.values()),
    }


def main():
    argumentos = argparse.ArgumentParser()
    argumentos.add_argument("--pdf", help="ler um PDF já baixado em vez de buscar o último no site")
    argumentos.add_argument("--saida", help="onde gravar (padrão: public/dados/precos-rs.json)")
    a = argumentos.parse_args()
    endereco = a.pdf or ultimo_boletim()
    conteudo = pathlib.Path(a.pdf).read_bytes() if a.pdf else baixar(endereco)
    dados = ler(conteudo, endereco)
    destino = pathlib.Path(a.saida) if a.saida else DESTINO
    anterior = json.loads(destino.read_text()) if destino.exists() else {}
    if anterior.get("pdf") == dados["pdf"] and anterior.get("produtos") == dados["produtos"]:
        print("O boletim é o mesmo de antes: nada a gravar.")
        return
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n")
    print(f"Boletim nº {dados['boletim']} ({dados['semana']}): {len(dados['produtos'])} produtos, "
          f"{sum(len(p.get('municipios', [])) for p in dados['produtos'])} preços por município.")


if __name__ == "__main__":
    main()
