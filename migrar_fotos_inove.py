# -*- coding: utf-8 -*-
"""
Corrige/migra as fotos da INOVE para as novas pastas de categoria.

Use depois de substituir o produtos-inove.js corrigido.
Ele copia imagens existentes de "fotos inove/outros" ou outras pastas antigas
para o novo caminho esperado no produtos-inove.js.
"""

import json
import re
import shutil
from pathlib import Path

ARQUIVO_PRODUTOS = "produtos-inove.js"

def carregar_produtos():
    texto = Path(ARQUIVO_PRODUTOS).read_text(encoding="utf-8")
    m = re.search(r"const\s+produtos\s*=\s*(\[.*\]);?\s*$", texto, re.S)
    if not m:
        raise RuntimeError("Não consegui ler o array const produtos no produtos-inove.js")
    return json.loads(m.group(1))

def procurar_arquivo(nome):
    base = Path("fotos inove")
    if not base.exists():
        return None
    encontrados = list(base.rglob(nome))
    return encontrados[0] if encontrados else None

def main():
    produtos = carregar_produtos()
    copiados = 0
    faltando = 0

    print("MIGRAÇÃO DE FOTOS INOVE")
    print("=======================")

    for produto in produtos:
        imagem = produto.get("imagem")
        if not imagem:
            continue

        destino = Path(imagem)
        nome = destino.name

        if destino.exists() and destino.stat().st_size > 0:
            continue

        origem = procurar_arquivo(nome)
        if origem:
            destino.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(origem, destino)
            copiados += 1
            print(f"OK {produto.get('referencia')} -> {destino}")
        else:
            faltando += 1
            print(f"FALTOU {produto.get('referencia')} -> {destino}")

    print("\nFINALIZADO")
    print(f"Fotos copiadas para novas pastas: {copiados}")
    print(f"Fotos não encontradas: {faltando}")

if __name__ == "__main__":
    main()
