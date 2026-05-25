import re
import json
from pathlib import Path
from PIL import Image
from tqdm import tqdm
import pdfplumber

PDF_PRECOS = Path("TABELA PREÇO.pdf")
PASTA_FOTOS = Path("FOTOS")

PASTA_IMAGENS_OTIMIZADAS = Path("FOTOS_ZARRARA_OTIMIZADAS")

SAIDA_JS = Path("produtos-zarrara.js")
SAIDA_JSON = Path("produtos-zarrara.json")
SAIDA_RELATORIO = Path("relatorio_importacao.json")

EXTENSOES_IMAGEM = {".jpg", ".jpeg", ".png", ".webp"}

LARGURA_MAXIMA_IMAGEM = 900
QUALIDADE_JPG = 82


def moeda_para_float(valor):
    valor = str(valor).strip()

    # Aceita tanto padrão brasileiro: 1.234,56
    # quanto padrão com ponto decimal: 25.87
    if "," in valor:
        valor = valor.replace(".", "").replace(",", ".")

    return float(valor)


def normalizar_ref(ref):
    ref = ref.upper().strip()
    ref = ref.replace(" ", "")
    ref = ref.replace("_", "/")
    ref = ref.replace("\\", "/")
    return ref


def gerar_variacoes_ref(ref):
    ref = normalizar_ref(ref)
    variacoes = {ref}

    match = re.match(r"^([A-Z]+)-(\d+)$", ref)

    if match:
        prefixo, numero = match.groups()
        numero_int = int(numero)

        variacoes.add(f"{prefixo}-{numero_int}")
        variacoes.add(f"{prefixo}-{numero_int:03d}")
        variacoes.add(f"{prefixo}-{numero_int:04d}")

    return variacoes


def categoria_amigavel(nome_pasta):
    nome = nome_pasta.upper().strip()

    mapa = {
        "ALIANÇAS": "alianca",
        "ANÉIS": "anel",
        "ANEIS": "anel",
        "ARGOLAS (BA)": "argola",
        "ARGOLA DUPLA (BRD)": "argola",
        "BRACELETES": "bracelete",
        "BRINCO DE STRASS": "brinco",
        "BRINCOS": "brinco",
        "BRINCOS BABY (BRP)": "brinco",
        "BRINCOS DE TRIO (BRT)": "brinco",
        "CONJUNTO ( CJ )": "conjunto",
        "CORRENTES": "corrente",
        "GARG- INF": "gargantilha",
        "GARGANTILHAS": "gargantilha",
        "PINGENTES": "pingente",
        "PULSEIRA INFANTIL": "pulseira",
        "PULSEIRAS": "pulseira",
        "TORNOZELEIRAS": "tornozeleira",
    }

    return mapa.get(nome, nome_pasta.lower())


def caminho_relativo(path):
    return str(path).replace("\\", "/")


def otimizar_imagem(caminho_original):
    caminho_relativo_original = caminho_original.relative_to(PASTA_FOTOS)

    pasta_destino = PASTA_IMAGENS_OTIMIZADAS / caminho_relativo_original.parent
    pasta_destino.mkdir(parents=True, exist_ok=True)

    nome_destino = caminho_original.stem + ".jpg"
    caminho_destino = pasta_destino / nome_destino

    if caminho_destino.exists():
        return caminho_destino

    try:
        with Image.open(caminho_original) as img:
            img = img.convert("RGB")

            largura, altura = img.size

            if largura > LARGURA_MAXIMA_IMAGEM:
                nova_altura = int((LARGURA_MAXIMA_IMAGEM / largura) * altura)
                img = img.resize((LARGURA_MAXIMA_IMAGEM, nova_altura), Image.LANCZOS)

            img.save(
                caminho_destino,
                "JPEG",
                quality=QUALIDADE_JPG,
                optimize=True
            )

        return caminho_destino

    except Exception as erro:
        print(f"Erro ao otimizar imagem: {caminho_original} -> {erro}")
        return caminho_original


def extrair_precos_pdf(pdf_path):
    precos = {}
    referencias_base = set()

    padrao_linha = re.compile(
        r"^([A-Z0-9/_-]+(?:\s+[A-ZÇÃÕÉÍÓÚÂÊÔ]+)*)\s+R\$\s*([\d.,]+)\s+R\$\s*([\d.,]+)",
        re.IGNORECASE
    )

    with pdfplumber.open(pdf_path) as pdf:
        paginas = list(pdf.pages)

        for page in tqdm(paginas, desc="Lendo PDF de preços", unit="página"):
            texto = page.extract_text() or ""

            for linha in texto.splitlines():
                linha = linha.strip()

                match = padrao_linha.search(linha)

                if not match:
                    continue

                referencia_bruta = match.group(1).strip()

                preco_etiqueta = moeda_para_float(match.group(2))
                preco_desconto = moeda_para_float(match.group(3))

                referencia_base = referencia_bruta.split()[0]
                referencia = normalizar_ref(referencia_base)

                referencias_base.add(referencia)

                dados = {
                    "precoEtiqueta": preco_etiqueta,
                    "preco": preco_desconto,
                }

                precos[referencia] = dados

                for variacao in gerar_variacoes_ref(referencia):
                    precos[variacao] = dados

    return precos, referencias_base


def extrair_ref_do_nome(nome_arquivo):
    nome = Path(nome_arquivo).stem.upper()
    nome = nome.replace("_", "/")

    match = re.search(r"[A-Z]+-[A-Z]+\d+", nome)
    if match:
        return normalizar_ref(match.group(0))

    match = re.search(r"[A-Z]+\d+/\d+-\d+", nome)
    if match:
        return normalizar_ref(match.group(0))

    match = re.search(r"[A-Z]+-\d+", nome)
    if match:
        return normalizar_ref(match.group(0))

    match = re.search(r"[A-Z]+\d+", nome)
    if match:
        return normalizar_ref(match.group(0))

    return None


def encontrar_preco(precos, referencia):
    for tentativa in gerar_variacoes_ref(referencia):
        if tentativa in precos:
            return tentativa, precos[tentativa]

    return referencia, None


def gerar_produtos():
    print()
    print("INICIANDO IMPORTAÇÃO DO CATÁLOGO")
    print("--------------------------------")
    print("1/4 Lendo tabela de preços...")
    print()

    precos, referencias_base_pdf = extrair_precos_pdf(PDF_PRECOS)

    print()
    print("2/4 Procurando imagens nas pastas...")

    imagens = [
        arquivo
        for arquivo in PASTA_FOTOS.rglob("*")
        if arquivo.suffix.lower() in EXTENSOES_IMAGEM
    ]

    print(f"Imagens encontradas: {len(imagens)}")
    print()
    print("3/4 Cruzando fotos com preços e otimizando imagens...")
    print()

    grupos = {}

    sem_preco = []
    sem_referencia = []

    refs_fotos = set()

    for imagem in tqdm(imagens, desc="Processando imagens", unit="imagem"):
        referencia_original = extrair_ref_do_nome(imagem.name)

        if not referencia_original:
            sem_referencia.append(caminho_relativo(imagem))
            continue

        refs_fotos.add(referencia_original)

        referencia_final, dados_preco = encontrar_preco(precos, referencia_original)

        if not dados_preco:
            sem_preco.append({
                "referencia": referencia_original,
                "imagem": caminho_relativo(imagem)
            })
            continue

        categoria_original = imagem.parent.name
        categoria = categoria_amigavel(categoria_original)

        imagem_otimizada = otimizar_imagem(imagem)
        imagem_otimizada_path = caminho_relativo(imagem_otimizada)

        chave = (referencia_final, categoria)

        if chave not in grupos:
            grupos[chave] = {
                "referencia": referencia_final,
                "descricao": referencia_final,
                "categoria": categoria,
                "categoriaOriginal": categoria_original,
                "fabrica": "ZARRARA",
                "precoEtiqueta": dados_preco["precoEtiqueta"],
                "preco": dados_preco["preco"],
                "imagem": imagem_otimizada_path,
                "imagens": [],
            }

        grupos[chave]["imagens"].append(imagem_otimizada_path)

    print()
    print("4/4 Gerando arquivos finais...")

    produtos = list(grupos.values())

    for produto in produtos:
        produto["imagens"] = sorted(set(produto["imagens"]))
        produto["imagem"] = produto["imagens"][0]

    produtos.sort(
        key=lambda item: (
            item["categoria"],
            item["referencia"]
        )
    )

    refs_fotos_expandida = set()

    for ref in refs_fotos:
        refs_fotos_expandida.update(gerar_variacoes_ref(ref))

    pdf_com_foto = sorted(
        ref for ref in referencias_base_pdf
        if ref in refs_fotos_expandida
    )

    pdf_sem_foto = sorted(
        ref for ref in referencias_base_pdf
        if ref not in refs_fotos_expandida
    )

    conteudo_js = "const produtos = "
    conteudo_js += json.dumps(produtos, ensure_ascii=False, indent=2)
    conteudo_js += ";\n"

    SAIDA_JS.write_text(conteudo_js, encoding="utf-8")

    SAIDA_JSON.write_text(
        json.dumps(produtos, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    relatorio = {
        "total_precos_pdf": len(referencias_base_pdf),
        "total_imagens": len(imagens),
        "produtos_gerados": len(produtos),
        "pdf_com_foto": len(pdf_com_foto),
        "pdf_sem_foto": len(pdf_sem_foto),
        "sem_preco": sem_preco,
        "sem_referencia": sem_referencia,
        "lista_pdf_sem_foto": pdf_sem_foto,
    }

    SAIDA_RELATORIO.write_text(
        json.dumps(relatorio, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print()
    print("IMPORTAÇÃO FINALIZADA")
    print()

    print(f"Referências únicas no PDF: {len(referencias_base_pdf)}")
    print(f"Imagens encontradas: {len(imagens)}")
    print(f"Produtos gerados: {len(produtos)}")
    print(f"PDF com foto: {len(pdf_com_foto)}")
    print(f"PDF sem foto: {len(pdf_sem_foto)}")
    print(f"Sem preço: {len(sem_preco)}")
    print(f"Sem referência: {len(sem_referencia)}")

    print()
    print("Arquivos gerados:")
    print(f"- {SAIDA_JS}")
    print(f"- {SAIDA_JSON}")
    print(f"- {SAIDA_RELATORIO}")
    print(f"- {PASTA_IMAGENS_OTIMIZADAS}/")
    print()


if __name__ == "__main__":
    gerar_produtos()
