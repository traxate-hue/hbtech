# -*- coding: utf-8 -*-
"""
IMPORTADOR INOVE / LUIN PRATAS - API CONECTA VENDA

CORREÇÃO IMPORTANTE:
- A referência comercial correta vem do campo "produto_referencia" (ex.: LNGR0001).
- O campo "produto_id" é apenas ID interno da API (ex.: 11262518) e NÃO deve aparecer como referência no catálogo.

Uso:
    python importador_catalogo_inove_api.py
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from tqdm import tqdm


CATALOGO_ID = "21e8378dbe5fe277b8c6f1048e170dd7"
DOMINIO = "app.conectavenda.com.br"

FABRICA = "INOVE"
PASTA_FOTOS = "fotos inove"

URL_INICIAR = "https://dados.conectavenda.com.br/api/cliente/iniciar"
URL_LISTAR = "https://dados.conectavenda.com.br/api/produtos/listar"

ARQUIVO_RESPOSTA_API = "resposta_api_inove.json"
ARQUIVO_PRODUTOS_JS = "produtos-inove.js"
ARQUIVO_PRODUTOS_JSON = "produtos-inove.json"
ARQUIVO_RELATORIO = "relatorio_importacao_inove.json"

BAIXAR_IMAGENS = True
TIMEOUT = 30
PAUSA_DOWNLOAD = 0.02

# O site calcula o valor estimado por peso x COEFICIENTE_GRAMA no script.js.
# Por isso, aqui mantemos preco = 0 para INOVE.
PRECO_PADRAO = 0


PASTAS_CATEGORIA = {
    "anel": "aneis",
    "brinco": "brincos",
    "pulseira": "pulseiras",
    "pingente": "pingentes",
    "gargantilha": "gargantilhas",
    "berloque": "berloques",
    "escapulario": "escapularios",
    "conjunto": "conjuntos",
    "tornozeleira": "tornozeleiras",
    "infantil": "infantil",
}


def normalizar_categoria(item: dict) -> str:
    grupo = str(item.get("produto_grupo_descricao") or "").strip().upper()
    nome = str(item.get("produto_nome") or "").strip().upper()

    # Se o produto é infantil no nome, deixamos em categoria infantil,
    # mesmo que a API tenha trazido grupo BRINCO, ANEL, etc.
    if "INFANTIL" in grupo or "INFANTIL" in nome:
        return "infantil"

    if "GARGANTILHA" in grupo:
        return "gargantilha"
    if "BERLOQUE" in grupo:
        return "berloque"
    if "ESCAP" in grupo:
        return "escapulario"
    if "ANEL" in grupo or "SOLIT" in grupo or "APARADOR" in grupo:
        return "anel"
    if "BRINCO" in grupo:
        return "brinco"
    if "PULSEIRA" in grupo:
        return "pulseira"
    if "PINGENTE" in grupo:
        return "pingente"
    if "CONJUNTO" in grupo:
        return "conjunto"
    if "TORNOZELEIRA" in grupo:
        return "tornozeleira"

    return grupo.lower() or "outros"


def nome_arquivo_da_url(url: str) -> str:
    return Path(urlparse(url).path).name or "imagem.webp"


def caminho_local_imagem(categoria: str, url: str) -> str:
    pasta = PASTAS_CATEGORIA.get(categoria, categoria or "outros")
    nome = nome_arquivo_da_url(url)
    return f"{PASTA_FOTOS}/{pasta}/{nome}".replace("\\", "/")


def peso_texto(valor) -> str:
    if valor is None:
        return ""
    try:
        return f"{float(valor):g}g"
    except Exception:
        return str(valor)


def baixar_imagem(sessao: requests.Session, url: str, destino: Path) -> bool:
    if not url:
        return False

    if destino.exists() and destino.stat().st_size > 0:
        return True

    destino.parent.mkdir(parents=True, exist_ok=True)

    try:
        resp = sessao.get(url, timeout=TIMEOUT)
        if resp.status_code != 200 or not resp.content:
            return False
        destino.write_bytes(resp.content)
        return True
    except Exception:
        return False


def iniciar_sessao(sessao: requests.Session) -> str:
    headers = {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
        "origin": "https://app.conectavenda.com.br",
        "referer": "https://app.conectavenda.com.br/",
        "user-agent": "Mozilla/5.0",
    }

    payload = {
        "catalogo": CATALOGO_ID,
        "dominio": DOMINIO,
    }

    resp = sessao.post(URL_INICIAR, headers=headers, json=payload, timeout=TIMEOUT)

    session_header = resp.headers.get("conecta-session")
    if session_header:
        sessao.headers.update({"conecta-session": session_header})

    return session_header or ""


def buscar_produtos(sessao: requests.Session) -> list[dict]:
    headers = {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
        "origin": "https://app.conectavenda.com.br",
        "referer": "https://app.conectavenda.com.br/",
        "user-agent": "Mozilla/5.0",
    }

    payload = {
        "catalogo": CATALOGO_ID,
    }

    resp = sessao.post(URL_LISTAR, headers=headers, json=payload, timeout=TIMEOUT)
    print(f"   STATUS: {resp.status_code}")

    texto = resp.text
    Path(ARQUIVO_RESPOSTA_API).write_text(texto, encoding="utf-8")
    print(f"   Resposta bruta salva em: {ARQUIVO_RESPOSTA_API}")

    dados = resp.json()

    if isinstance(dados, list):
        return dados

    # Segurança caso a API mude e passe a devolver objeto.
    for valor in dados.values():
        if isinstance(valor, list):
            return valor

    return []


def montar_produto(item: dict) -> dict:
    # REFERÊNCIA CORRETA:
    # produto_referencia = referência comercial (LNGR0001, LNAN0001, etc.)
    # produto_id = ID interno da API, guardado separado em idApi.
    referencia = str(item.get("produto_referencia") or item.get("produto_id") or "").strip().upper()

    # Remove o prefixo LN das referências da INOVE.
    # Ex.: LNGR0001 -> GR0001 / LNAN0001 -> AN0001
    if referencia.startswith("LN"):
        referencia = referencia[2:]

    categoria = normalizar_categoria(item)

    imagens_originais = item.get("produto_imagens") or []
    imagem_original = imagens_originais[0] if imagens_originais else ""

    imagem_local = caminho_local_imagem(categoria, imagem_original) if imagem_original else ""

    return {
        "referencia": referencia,
        "idApi": item.get("produto_id"),
        "descricao": item.get("produto_nome") or referencia,
        "descricaoCompleta": item.get("produto_descricao") or "",
        "categoria": categoria,
        "categoriaOriginal": item.get("produto_grupo_descricao") or "",
        "fabrica": FABRICA,
        "peso": peso_texto(item.get("produto_peso")),
        "pesoNumero": item.get("produto_peso"),
        "preco": PRECO_PADRAO,
        "estoque": item.get("produto_estoque_total"),
        "quantidadeMinimaApi": item.get("produto_quantidade_minima"),
        "imagem": imagem_local,
        "imagem_original": imagem_original,
        "imagens": [imagem_local] if imagem_local else [],
        "imagens_originais": imagens_originais,
    }


def salvar_js(produtos: list[dict]) -> None:
    texto = "const produtos = " + json.dumps(produtos, ensure_ascii=False, indent=2) + ";\n"
    Path(ARQUIVO_PRODUTOS_JS).write_text(texto, encoding="utf-8")


def salvar_json(obj, caminho: str) -> None:
    Path(caminho).write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    print("IMPORTAÇÃO INOVE VIA API")
    print("========================")
    sessao = requests.Session()

    print("1/5 Iniciando sessão...")
    sessao_id = iniciar_sessao(sessao)
    print(f"   Sessão OK: {sessao_id or 'sem header'}")

    print("2/5 Buscando produtos na API...")
    itens_api = buscar_produtos(sessao)

    print("3/5 Extraindo produtos...")
    produtos = [montar_produto(item) for item in itens_api]
    print(f"   Produtos extraídos: {len(produtos)}")

    baixadas = 0
    falhas = []

    if BAIXAR_IMAGENS:
        print("4/5 Baixando imagens...")
        for produto in tqdm(produtos, desc="Imagens", unit="foto"):
            url = produto.get("imagem_original")
            if not url:
                falhas.append({"referencia": produto["referencia"], "motivo": "sem imagem"})
                continue

            destino = Path(produto["imagem"])
            ok = baixar_imagem(sessao, url, destino)

            if ok:
                baixadas += 1
            else:
                falhas.append({"referencia": produto["referencia"], "url": url})

            time.sleep(PAUSA_DOWNLOAD)
    else:
        print("4/5 Download de imagens desativado.")

    print("5/5 Gerando arquivos finais...")
    salvar_js(produtos)
    salvar_json(produtos, ARQUIVO_PRODUTOS_JSON)

    categorias = {}
    for p in produtos:
        categorias[p["categoria"]] = categorias.get(p["categoria"], 0) + 1

    relatorio = {
        "produtos_gerados": len(produtos),
        "referencia_usada": "produto_referencia",
        "id_api_guardado_em": "idApi",
        "imagens_baixadas_ou_existentes": baixadas,
        "sem_foto": sum(1 for p in produtos if not p.get("imagem_original")),
        "sem_peso": sum(1 for p in produtos if not p.get("pesoNumero")),
        "falhas_download": falhas,
        "categorias": categorias,
    }

    salvar_json(relatorio, ARQUIVO_RELATORIO)

    print()
    print("IMPORTAÇÃO FINALIZADA")
    print("====================")
    print(f"Produtos gerados: {len(produtos)}")
    print(f"Imagens baixadas/existentes: {baixadas}")
    print(f"Sem foto: {relatorio['sem_foto']}")
    print(f"Sem peso: {relatorio['sem_peso']}")
    print(f"Falhas de download: {len(falhas)}")
    print()
    print("Arquivos gerados:")
    print(f"- {ARQUIVO_PRODUTOS_JS}")
    print(f"- {ARQUIVO_PRODUTOS_JSON}")
    print(f"- {ARQUIVO_RELATORIO}")
    print(f"- {ARQUIVO_RESPOSTA_API}")


if __name__ == "__main__":
    main()
