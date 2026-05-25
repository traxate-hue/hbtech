# -*- coding: utf-8 -*-
"""
IMPORTADOR CATÁLOGO INOVE / LUIN PRATAS - CONECTA VENDA

O que este script faz:
1. Lê um arquivo HTML/JSON/TXT exportado/colado do catálogo.
2. Extrai produtos: referência/SKU, descrição, categoria, peso, tamanhos/estoque e foto.
3. Calcula preço pelo peso, usando PRECO_POR_GRAMA.
4. Baixa as imagens para a pasta "fotos inove", separando por categoria.
5. Gera produtos-inove.js, produtos-inove.json e relatorio_importacao_inove.json.

Como usar:
    python importador_catalogo_inove.py

Antes de rodar, ajuste principalmente:
    ARQUIVO_ENTRADA
    PRECO_POR_GRAMA
"""

from __future__ import annotations

import json
import os
import re
import time
import html as html_lib
from pathlib import Path
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    requests = None


# =========================
# CONFIGURAÇÕES PRINCIPAIS
# =========================

ARQUIVO_ENTRADA = "Texto colado(11).txt"
FABRICA = "INOVE"
PASTA_FOTOS = "fotos inove"

# IMPORTANTE: coloque aqui o valor correto por grama.
# Exemplo: se a prata for R$ 9,90/g, use 9.90
PRECO_POR_GRAMA = 19.00

# Se quiser gerar preço de etiqueta com margem, altere aqui.
# Exemplo: 1.30 gera etiqueta 30% maior que o preço base.
MULTIPLICADOR_PRECO_ETIQUETA = 1.00

# Tamanho da imagem no Conecta Venda. No seu HTML veio /413/.
# Se quiser tentar maior, troque para 900. Caso não exista, volte para 413.
TAMANHO_IMAGEM_URL = None  # None mantém a URL original; ou use 900, 413 etc.

BAIXAR_IMAGENS = True
PAUSA_ENTRE_DOWNLOADS = 0.05
TIMEOUT_DOWNLOAD = 30

ARQUIVO_PRODUTOS_JS = "produtos-inove.js"
ARQUIVO_PRODUTOS_JSON = "produtos-inove.json"
ARQUIVO_RELATORIO = "relatorio_importacao_inove.json"


# =========================
# MAPAS DE CATEGORIA
# =========================

MAPA_PREFIXO_SKU = {
    "LNAN": "anel",
    "LNBR": "brinco",
    "LNCO": "corrente",
    "LNCR": "corrente",
    "LNPI": "pingente",
    "LNPU": "pulseira",
    "LNPL": "pulseira",
    "LNTO": "tornozeleira",
    "LNAL": "alianca",
    "LNES": "escapulario",
    "LNGA": "gargantilha",
    "LNGG": "gargantilha",
    "LNIN": "infantil",
    "LNBE": "berloque",
}

PASTA_POR_CATEGORIA = {
    "anel": "aneis",
    "brinco": "brincos",
    "corrente": "correntes",
    "pingente": "pingentes",
    "pulseira": "pulseiras",
    "tornozeleira": "tornozeleiras",
    "alianca": "aliancas",
    "escapulario": "escapularios",
    "berloque": "berloques",
    "gargantilha": "gargantilhas",
    "infantil": "infantil",
    "piercing": "piercings",
}


# =========================
# FUNÇÕES AUXILIARES
# =========================

def limpar_html(texto: str) -> str:
    texto = re.sub(r"<[^>]+>", " ", texto or "")
    texto = html_lib.unescape(texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    return texto


def normalizar_numero(valor) -> float | None:
    if valor is None:
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    texto = str(valor).strip().lower().replace("g", "")
    texto = texto.replace(".", "").replace(",", ".") if "," in texto else texto
    texto = re.sub(r"[^0-9.\-]", "", texto)
    if not texto:
        return None
    try:
        return float(texto)
    except ValueError:
        return None


def dinheiro(valor: float | None) -> float | None:
    if valor is None:
        return None
    return round(float(valor) + 1e-9, 2)


def nome_arquivo_da_url(url: str) -> str:
    caminho = urlparse(url).path
    nome = Path(caminho).name
    return nome or "imagem.webp"


def ajustar_url_imagem(url: str) -> str:
    if not TAMANHO_IMAGEM_URL:
        return url
    # Troca /413/ ou /900/ por outro tamanho, mantendo o resto da URL.
    return re.sub(r"/(\d{2,4})/([^/]+)$", f"/{TAMANHO_IMAGEM_URL}/\\2", url)


def categoria_chave(valor: str) -> str:
    texto = str(valor or "").strip().lower()
    texto = html_lib.unescape(texto)
    texto = texto.replace("ç", "c")
    texto = texto.replace("ã", "a").replace("á", "a").replace("à", "a").replace("â", "a")
    texto = texto.replace("é", "e").replace("ê", "e")
    texto = texto.replace("í", "i")
    texto = texto.replace("ó", "o").replace("ô", "o").replace("õ", "o")
    texto = texto.replace("ú", "u")
    texto = re.sub(r"[^a-z0-9]+", "-", texto).strip("-")
    return texto


def normalizar_categoria(categoria: str, sku: str = "", nome: str = "") -> str:
    texto = " ".join([str(categoria or ""), str(sku or ""), str(nome or "")])
    chave = categoria_chave(texto)

    if "infantil" in chave or "-cji" in chave or chave.startswith("cji"):
        return "infantil"
    if "gargantilha" in chave or "gargantilhas" in chave or "choker" in chave:
        return "gargantilha"
    if "berloque" in chave or "berloques" in chave:
        return "berloque"
    if "escapulario" in chave or "escapularios" in chave:
        return "escapulario"
    if "alianca" in chave or "aliancas" in chave:
        return "alianca"
    if "anel" in chave or "aneis" in chave:
        return "anel"
    if "brinco" in chave or "brincos" in chave or "argola" in chave or "click" in chave:
        return "brinco"
    if "corrente" in chave or "correntes" in chave or "colar" in chave:
        return "corrente"
    if "pingente" in chave or "pingentes" in chave:
        return "pingente"
    if "pulseira" in chave or "pulseiras" in chave or "bracelete" in chave:
        return "pulseira"
    if "tornozeleira" in chave or "tornozeleiras" in chave:
        return "tornozeleira"
    if "piercing" in chave or "piercings" in chave:
        return "piercing"

    cat_limpa = categoria_chave(categoria)
    return cat_limpa or "outros"



def categoria_por_sku(sku: str, nome: str = "") -> str:
    sku_upper = str(sku or "").upper()
    for prefixo, categoria in MAPA_PREFIXO_SKU.items():
        if sku_upper.startswith(prefixo):
            return categoria

    return normalizar_categoria("", sku, nome)


def caminho_foto(categoria: str, url: str) -> str:
    pasta_categoria = PASTA_POR_CATEGORIA.get(categoria, categoria or "outros")
    nome = nome_arquivo_da_url(url)
    return f"{PASTA_FOTOS}/{pasta_categoria}/{nome}".replace("\\", "/")


def baixar_imagem(url: str, destino: Path) -> bool:
    if destino.exists() and destino.stat().st_size > 0:
        return True
    if requests is None:
        print("⚠️ Biblioteca requests não instalada. Instale com: pip install requests")
        return False

    destino.parent.mkdir(parents=True, exist_ok=True)
    try:
        resp = requests.get(url, timeout=TIMEOUT_DOWNLOAD, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200 or not resp.content:
            return False
        destino.write_bytes(resp.content)
        return True
    except Exception:
        return False


# =========================
# EXTRAÇÃO DE HTML RENDERIZADO
# =========================

def extrair_produtos_de_html(conteudo: str) -> list[dict]:
    """Extrai produtos de um HTML renderizado do Conecta Venda."""
    produtos = []

    # Padrão mais importante: blocos que contêm "SKU XXXXX".
    ocorrencias = list(re.finditer(r"SKU\s+([A-Z]{2,}[A-Z0-9]*\d+)", conteudo))

    for idx, match in enumerate(ocorrencias, start=1):
        sku = match.group(1).strip().upper()
        pos_sku = match.start()

        # Recorte seguro: antes pega imagem/título, depois pega descrição/tamanhos.
        ini = max(0, pos_sku - 5000)
        fim = min(len(conteudo), pos_sku + 7000)
        bloco = conteudo[ini:fim]
        pos_sku_bloco = pos_sku - ini
        antes_sku = bloco[:pos_sku_bloco]
        depois_sku = bloco[pos_sku_bloco:]

        # Nome/título imediatamente antes do SKU.
        titulo_match = re.search(
            r'text-highlight text-left[^>]*>(.*?)</span>\s*<span[^>]*>\s*SKU\s+' + re.escape(sku),
            bloco,
            flags=re.I | re.S,
        )
        nome = limpar_html(titulo_match.group(1)) if titulo_match else sku

        # Descrição imediatamente depois do SKU.
        desc_match = re.search(
            r"SKU\s+" + re.escape(sku) + r"\s*</span>\s*<div[^>]*>(.*?)</div>",
            bloco,
            flags=re.I | re.S,
        )
        descricao = limpar_html(desc_match.group(1)) if desc_match else nome
        if not descricao:
            descricao = nome

        # Imagens antes do SKU; a última antes do SKU costuma ser a foto do produto atual.
        imgs = re.findall(r'<img[^>]+src="([^"]+)"[^>]+alt="([^"]*)"', antes_sku, flags=re.I | re.S)
        imagens_produto = []
        if imgs:
            url_img, alt_img = imgs[-1]
            imagens_produto.append(ajustar_url_imagem(html_lib.unescape(url_img)))
            if nome == sku and alt_img:
                nome = limpar_html(alt_img)

        # Tamanhos/estoque/peso depois do SKU.
        variacoes = []
        for tam, estoque, peso in re.findall(
            r">\s*TAM\s*([^<]+)</p>\s*<p[^>]*>\s*Estoque:\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*g",
            depois_sku,
            flags=re.I | re.S,
        ):
            peso_float = normalizar_numero(peso)
            variacoes.append({
                "tamanho": limpar_html(tam),
                "estoque": int(normalizar_numero(estoque) or 0),
                "peso": peso_float,
            })

        # Evita capturar variações de produtos seguintes: quando tem SKU próximo no recorte.
        # Como o recorte pode passar para o próximo card, limitamos pelo próximo "SKU" real quando existir.
        proximo_sku = re.search(r"SKU\s+[A-Z]{2,}[A-Z0-9]*\d+", depois_sku[10:], flags=re.I)
        if proximo_sku:
            trecho_proprio = depois_sku[:proximo_sku.start() + 10]
            variacoes = []
            for tam, estoque, peso in re.findall(
                r">\s*TAM\s*([^<]+)</p>\s*<p[^>]*>\s*Estoque:\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*g",
                trecho_proprio,
                flags=re.I | re.S,
            ):
                peso_float = normalizar_numero(peso)
                variacoes.append({
                    "tamanho": limpar_html(tam),
                    "estoque": int(normalizar_numero(estoque) or 0),
                    "peso": peso_float,
                })

        pesos = [v["peso"] for v in variacoes if v.get("peso") is not None]
        peso_base = pesos[0] if pesos else None

        categoria = categoria_por_sku(sku, nome)
        url_original = imagens_produto[0] if imagens_produto else ""
        imagem_local = caminho_foto(categoria, url_original) if url_original else ""

        preco = dinheiro((peso_base or 0) * PRECO_POR_GRAMA) if PRECO_POR_GRAMA else None
        preco_etiqueta = dinheiro(preco * MULTIPLICADOR_PRECO_ETIQUETA) if preco is not None else None

        produto = {
            "referencia": sku,
            "descricao": descricao,
            "nome": nome,
            "categoria": categoria,
            "categoriaOriginal": categoria,
            "fabrica": FABRICA,
            "peso": f"{peso_base:g}g" if peso_base is not None else "",
            "pesoNumero": peso_base,
            "preco": preco,
            "precoEtiqueta": preco_etiqueta,
            "imagem": imagem_local,
            "imagem_original": url_original,
            "imagens": [imagem_local] if imagem_local else [],
            "imagens_originais": imagens_produto,
            "variacoes": variacoes,
        }
        produtos.append(produto)

    # Remove duplicados mantendo o primeiro.
    unicos = {}
    for p in produtos:
        if p["referencia"] not in unicos:
            unicos[p["referencia"]] = p
    return list(unicos.values())


# =========================
# EXTRAÇÃO DE JSON GENÉRICO
# =========================

def procurar_listas(obj):
    if isinstance(obj, list):
        if obj and all(isinstance(x, dict) for x in obj):
            yield obj
        for item in obj:
            yield from procurar_listas(item)
    elif isinstance(obj, dict):
        for valor in obj.values():
            yield from procurar_listas(valor)


def achar_campo(d: dict, nomes: list[str]):
    mapa = {str(k).lower(): k for k in d.keys()}
    for nome in nomes:
        k = mapa.get(nome.lower())
        if k is not None:
            return d.get(k)
    return None


def extrair_url_imagem_de_dict(d: dict) -> str:
    candidatos = []
    for k, v in d.items():
        kl = str(k).lower()
        if isinstance(v, str) and ("http" in v) and any(ext in v.lower() for ext in [".webp", ".jpg", ".jpeg", ".png"]):
            candidatos.append(v)
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, str) and "http" in item and any(ext in item.lower() for ext in [".webp", ".jpg", ".jpeg", ".png"]):
                    candidatos.append(item)
                elif isinstance(item, dict):
                    u = extrair_url_imagem_de_dict(item)
                    if u:
                        candidatos.append(u)
        elif isinstance(v, dict) and any(palavra in kl for palavra in ["imagem", "image", "foto", "photo"]):
            u = extrair_url_imagem_de_dict(v)
            if u:
                candidatos.append(u)
    return candidatos[0] if candidatos else ""


def extrair_produtos_de_json(conteudo: str) -> list[dict]:
    try:
        dados = json.loads(conteudo)
    except Exception:
        return []

    melhor_lista = []
    for lista in procurar_listas(dados):
        score = 0
        for item in lista[:20]:
            chaves = " ".join(map(str, item.keys())).lower()
            if any(x in chaves for x in ["sku", "referencia", "referência", "codigo", "código"]):
                score += 2
            if any(x in chaves for x in ["peso", "weight", "grama"]):
                score += 2
            if any(x in chaves for x in ["imagem", "image", "foto", "photo"]):
                score += 2
        if score > 0 and len(lista) > len(melhor_lista):
            melhor_lista = lista

    produtos = []
    for item in melhor_lista:
        sku = achar_campo(item, ["sku", "referencia", "referência", "codigo", "código", "code"])
        if not sku:
            continue
        sku = str(sku).strip().upper()
        nome = str(achar_campo(item, ["nome", "name", "titulo", "título", "produto", "descricao", "descrição"]) or sku).strip()
        descricao = str(achar_campo(item, ["descricao", "descrição", "description", "detalhes"]) or nome).strip()
        peso_base = normalizar_numero(achar_campo(item, ["peso", "weight", "gramas", "grama"] ))
        categoria_original_api = str(achar_campo(item, ["categoria", "category", "grupo"]) or "").strip()
        if categoria_original_api:
            categoria = normalizar_categoria(categoria_original_api, sku, nome)
        else:
            categoria = categoria_por_sku(sku, nome)
        url_original = ajustar_url_imagem(extrair_url_imagem_de_dict(item))
        imagem_local = caminho_foto(categoria, url_original) if url_original else ""
        preco = dinheiro((peso_base or 0) * PRECO_POR_GRAMA) if PRECO_POR_GRAMA else None
        preco_etiqueta = dinheiro(preco * MULTIPLICADOR_PRECO_ETIQUETA) if preco is not None else None
        produtos.append({
            "referencia": sku,
            "descricao": descricao,
            "nome": nome,
            "categoria": categoria,
            "categoriaOriginal": categoria,
            "fabrica": FABRICA,
            "peso": f"{peso_base:g}g" if peso_base is not None else "",
            "pesoNumero": peso_base,
            "preco": preco,
            "precoEtiqueta": preco_etiqueta,
            "imagem": imagem_local,
            "imagem_original": url_original,
            "imagens": [imagem_local] if imagem_local else [],
            "imagens_originais": [url_original] if url_original else [],
            "variacoes": [],
        })
    return produtos


# =========================
# SAÍDA
# =========================

def salvar_js(produtos: list[dict], caminho: str):
    texto = "const produtos = " + json.dumps(produtos, ensure_ascii=False, indent=2) + ";\n"
    Path(caminho).write_text(texto, encoding="utf-8")


def salvar_json(obj, caminho: str):
    Path(caminho).write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    entrada = Path(ARQUIVO_ENTRADA)
    if not entrada.exists():
        print(f"❌ Arquivo de entrada não encontrado: {entrada.resolve()}")
        print("Coloque o TXT/HTML/JSON na mesma pasta do script ou ajuste ARQUIVO_ENTRADA.")
        return

    print("IMPORTAÇÃO INOVE")
    print("================")
    print(f"Lendo arquivo: {entrada}")

    conteudo = entrada.read_text(encoding="utf-8", errors="ignore")

    produtos = extrair_produtos_de_json(conteudo)
    origem = "json"
    if not produtos:
        produtos = extrair_produtos_de_html(conteudo)
        origem = "html"

    print(f"Produtos extraídos ({origem}): {len(produtos)}")

    baixadas = 0
    falhas_download = []

    if BAIXAR_IMAGENS:
        print("\nBaixando imagens...")
        total_com_imagem = sum(1 for p in produtos if p.get("imagem_original"))
        atual = 0
        for p in produtos:
            url = p.get("imagem_original")
            if not url:
                continue
            atual += 1
            destino = Path(p["imagem"])
            ok = baixar_imagem(url, destino)
            if ok:
                baixadas += 1
                status = "OK"
            else:
                falhas_download.append({"referencia": p["referencia"], "url": url})
                status = "FALHOU"
            print(f"[{atual}/{total_com_imagem}] {status} {p['referencia']} -> {p['imagem']}")
            time.sleep(PAUSA_ENTRE_DOWNLOADS)

    salvar_js(produtos, ARQUIVO_PRODUTOS_JS)
    salvar_json(produtos, ARQUIVO_PRODUTOS_JSON)

    relatorio = {
        "fabrica": FABRICA,
        "arquivo_entrada": str(entrada),
        "origem_detectada": origem,
        "preco_por_grama": PRECO_POR_GRAMA,
        "produtos_gerados": len(produtos),
        "produtos_com_foto": sum(1 for p in produtos if p.get("imagem_original")),
        "produtos_sem_foto": sum(1 for p in produtos if not p.get("imagem_original")),
        "produtos_com_peso": sum(1 for p in produtos if p.get("pesoNumero") is not None),
        "produtos_sem_peso": sum(1 for p in produtos if p.get("pesoNumero") is None),
        "imagens_baixadas": baixadas,
        "falhas_download": falhas_download,
        "categorias": {},
    }
    for p in produtos:
        relatorio["categorias"][p["categoria"]] = relatorio["categorias"].get(p["categoria"], 0) + 1

    salvar_json(relatorio, ARQUIVO_RELATORIO)

    print("\nIMPORTAÇÃO FINALIZADA")
    print(f"Produtos gerados: {len(produtos)}")
    print(f"Imagens baixadas: {baixadas}")
    print(f"Sem foto: {relatorio['produtos_sem_foto']}")
    print(f"Sem peso: {relatorio['produtos_sem_peso']}")
    print("\nArquivos gerados:")
    print(f"- {ARQUIVO_PRODUTOS_JS}")
    print(f"- {ARQUIVO_PRODUTOS_JSON}")
    print(f"- {ARQUIVO_RELATORIO}")
    print(f"- pasta: {PASTA_FOTOS}/")

    if PRECO_POR_GRAMA == 0:
        print("\n⚠️ ATENÇÃO: PRECO_POR_GRAMA está 0.00.")
        print("Edite essa configuração no começo do script para gerar os preços corretamente.")


if __name__ == "__main__":
    main()
