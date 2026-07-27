# -*- coding: utf-8 -*-
"""
copiar_plantas.py
=================
Copia as plantas do OneDrive para /obra/plantas/ e gera o indice em
/obra/js/plantas.js.

Porque existe:
- O GitHub Pages so serve ficheiros versionados no repo; nao alcanca o OneDrive.
- Por isso as imagens/PDF tem de ser COPIADAS para dentro do repo.

Regras:
- NUNCA escreve nada dentro do OneDrive (esses caminhos sao so-leitura).
- E' idempotente: podes corre-lo outra vez sempre que o arquiteto atualizar
  os desenhos. Basta:  python scripts/copiar_plantas.py
- Se acrescentares um ficheiro NOVO a pasta "05. Projetos especialidade" que
  nao seja uma das 8 marcacoes conhecidas, ele aparece automaticamente como
  "Projeto de especialidade" no indice.

Muda os caminhos na seccao CAMINHOS se o OneDrive mudar de sitio.
"""

from pathlib import Path
import json
import os
import stat
import shutil
import sys

# --------------------------------------------------------------------------
# CAMINHOS  (unico sitio a mexer se o OneDrive mudar de local)
# --------------------------------------------------------------------------
BASE = Path(
    r"C:\Users\João Ribeiro\OneDrive - Kaizen Institute Ltd. (KIAG)"
    r"\Documents\11.Bragança"
)
PASTA_ARQUITETURA = BASE / "01. Projeto Arquitetura" / "Planta 1_100 com medidas"
PASTA_ESPECIALIDADE = BASE / "05. Projetos especialidade"

# Destino dentro do repo (este script vive em /scripts, o destino em /obra)
RAIZ_REPO = Path(__file__).resolve().parent.parent
DESTINO = RAIZ_REPO / "obra" / "plantas"
INDICE_JS = RAIZ_REPO / "obra" / "js" / "plantas.js"

LIMITE_AVISO_MB = 25  # avisa antes de copiar ficheiros maiores que isto

# --------------------------------------------------------------------------
# PLANTA BASE DE ARQUITETURA
# --------------------------------------------------------------------------
ARQUITETURA = {
    "origem": PASTA_ARQUITETURA / "João Ribeiro 02.pdf",
    "ficheiro": "00_arquitetura.pdf",
    "id": "00_arquitetura",
    "tipo": "arquitetura",
    "especialidade": "Arquitetura",
    "titulo": "Planta base (1:100, cotada)",
    "conteudo": "Planta de arquitetura cotada. Base de todas as marcações de obra.",
}

# --------------------------------------------------------------------------
# AS 8 MARCACOES DE OBRA
# Mapeia o nome EXATO no OneDrive -> metadados de destino.
# (identificadas visualmente uma a uma; ver brief seccao 5.2)
# --------------------------------------------------------------------------
MARCACOES = {
    "WhatsApp Image 2026-07-06 at 10.56.09 (4).jpeg": {
        "ficheiro": "01_demolicoes.jpeg", "id": "01_demolicoes",
        "especialidade": "Demolições", "titulo": "Demolições",
        "conteudo": "Rodapés a arrancar; 1-WC, 2-banca junto ao vão, "
                    "3-janela→porta, 4-janela.",
    },
    "WhatsApp Image 2026-07-06 at 10.56.09 (6).jpeg": {
        "ficheiro": "02_alvenarias.jpeg", "id": "02_alvenarias",
        "especialidade": "Alvenarias", "titulo": "Alvenarias",
        "conteudo": "Contagem de tijolos 100/50/20 → 117,5 m²; "
                    "lã de rocha 39 m².",
    },
    "WhatsApp Image 2026-07-06 at 10.56.09 (7).jpeg": {
        "ficheiro": "03_saneamento_agua.jpeg", "id": "03_saneamento_agua",
        "especialidade": "Saneamento e Água", "titulo": "Saneamento e Água",
        "conteudo": "Redes pelo teto falso; tubo desce pelo café até à garagem; "
                    "contador das 2 frações no exterior; 2× bomba de calor.",
    },
    "WhatsApp Image 2026-07-06 at 10.56.09 (5).jpeg": {
        "ficheiro": "04_carpintarias.jpeg", "id": "04_carpintarias",
        "especialidade": "Carpintarias", "titulo": "Carpintarias",
        "conteudo": "2×70 + 2×80 = 4 portas; armário roupeiro 2× 1,80 ml até ao "
                    "teto; rodapés PVC; ombreiras + padieiras.",
    },
    "WhatsApp Image 2026-07-06 at 10.56.09 (1).jpeg": {
        "ficheiro": "05_iluminacao.jpeg", "id": "05_iluminacao",
        "especialidade": "Iluminação e QE", "titulo": "Iluminação e QE",
        "conteudo": "Focos, pontos de luz e pontos de luz exterior "
                    "(aproveitar instalação existente).",
    },
    "WhatsApp Image 2026-07-06 at 10.56.09 (2).jpeg": {
        "ficheiro": "06_interruptores.jpeg", "id": "06_interruptores",
        "especialidade": "Interruptores e QE", "titulo": "Interruptores e QE",
        "conteudo": "Posição de interruptores (A) + 2 quadros elétricos.",
    },
    "WhatsApp Image 2026-07-06 at 10.56.09 (3).jpeg": {
        "ficheiro": "07_peitoris.jpeg", "id": "07_peitoris",
        "especialidade": "Peitoris", "titulo": "Peitoris",
        "conteudo": "11 vãos numerados com estado (ok/partido/não tem/"
                    "transformar) e medidas.",
    },
    "WhatsApp Image 2026-07-06 at 10.56.09.jpeg": {
        "ficheiro": "08_tomadas.jpeg", "id": "08_tomadas",
        "especialidade": "Tomadas", "titulo": "Tomadas",
        "conteudo": "Posição de tomadas por divisão (marcas «T»).",
    },
}

# extensoes que o browser nao abre -> avisar o dono de obra
EXTENSOES_NAO_WEB = {".pln", ".dwg", ".dxf", ".skp"}


# --------------------------------------------------------------------------
# AUXILIARES
# --------------------------------------------------------------------------
def e_placeholder_onedrive(caminho: Path) -> bool:
    """True se o ficheiro e' um placeholder cloud-only do OneDrive Files
    On-Demand (aparece na listagem mas o conteudo nao esta em disco)."""
    try:
        atrib = os.stat(caminho).st_file_attributes  # so existe no Windows
    except (OSError, AttributeError):
        return False
    FILE_ATTRIBUTE_OFFLINE = 0x1000
    FILE_ATTRIBUTE_RECALL_ON_OPEN = 0x40000
    FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS = 0x400000
    mascara = (FILE_ATTRIBUTE_OFFLINE
               | FILE_ATTRIBUTE_RECALL_ON_OPEN
               | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS)
    return bool(atrib & mascara)


def sanitizar(nome: str) -> str:
    """Nome de ficheiro sem acentos nem espacos, seguro para URL."""
    import unicodedata
    base = unicodedata.normalize("NFKD", nome)
    base = base.encode("ascii", "ignore").decode("ascii")
    base = base.replace(" ", "_")
    return "".join(c for c in base if c.isalnum() or c in "._-")


def copiar_um(origem: Path, ficheiro_destino: str, avisos: list) -> bool:
    """Copia UM ficheiro para DESTINO. Devolve True se copiou."""
    if not origem.exists():
        avisos.append(f"  [FALTA] nao encontrado: {origem}")
        return False
    if e_placeholder_onedrive(origem):
        avisos.append(
            f"  [CLOUD] '{origem.name}' e' placeholder OneDrive (cloud-only). "
            f"Forca 'Manter sempre neste dispositivo' e corre outra vez."
        )
        return False
    ext = origem.suffix.lower()
    if ext in EXTENSOES_NAO_WEB:
        avisos.append(
            f"  [FORMATO] '{origem.name}' ({ext}) nao abre no browser. "
            f"Pede exportacao em PDF ao arquiteto."
        )
    mb = origem.stat().st_size / (1024 * 1024)
    if mb > LIMITE_AVISO_MB:
        avisos.append(
            f"  [GRANDE] '{origem.name}' tem {mb:.1f} MB (> {LIMITE_AVISO_MB} MB)."
        )
    shutil.copy2(origem, DESTINO / ficheiro_destino)
    print(f"  copiado: {origem.name}  ->  {ficheiro_destino}  ({mb:.2f} MB)")
    return True


# --------------------------------------------------------------------------
# PRINCIPAL
# --------------------------------------------------------------------------
def main() -> int:
    print(f"Repo:    {RAIZ_REPO}")
    print(f"Destino: {DESTINO}")
    DESTINO.mkdir(parents=True, exist_ok=True)

    avisos: list = []
    indice: list = []

    # 1) planta base de arquitetura
    print("\n-- Arquitetura --")
    if copiar_um(ARQUITETURA["origem"], ARQUITETURA["ficheiro"], avisos):
        indice.append({k: v for k, v in ARQUITETURA.items() if k != "origem"})

    # 2) as 8 marcacoes de obra (por nome exato)
    print("\n-- Marcacoes de obra --")
    nomes_marcacoes = set(MARCACOES.keys())
    for nome_origem, meta in MARCACOES.items():
        origem = PASTA_ESPECIALIDADE / nome_origem
        if copiar_um(origem, meta["ficheiro"], avisos):
            indice.append({
                "id": meta["id"], "ficheiro": meta["ficheiro"],
                "tipo": "marcacao", "especialidade": meta["especialidade"],
                "titulo": meta["titulo"], "conteudo": meta["conteudo"],
            })

    # 3) qualquer OUTRO ficheiro em 05 = projeto de especialidade formal
    print("\n-- Projetos de especialidade formais --")
    encontrou_extra = False
    if PASTA_ESPECIALIDADE.exists():
        for origem in sorted(PASTA_ESPECIALIDADE.iterdir()):
            if not origem.is_file() or origem.name in nomes_marcacoes:
                continue
            encontrou_extra = True
            ficheiro_destino = sanitizar(origem.name)
            if copiar_um(origem, ficheiro_destino, avisos):
                indice.append({
                    "id": "esp_" + Path(ficheiro_destino).stem,
                    "ficheiro": ficheiro_destino, "tipo": "especialidade",
                    "especialidade": origem.stem, "titulo": origem.stem,
                    "conteudo": "",
                })
    if not encontrou_extra:
        print("  (nenhum — so existem as 8 marcacoes de obra)")

    # 4) gerar o indice js/plantas.js
    ordem_tipo = {"arquitetura": 0, "especialidade": 1, "marcacao": 2}
    indice.sort(key=lambda p: (ordem_tipo.get(p["tipo"], 9), p["id"]))
    corpo = json.dumps(indice, ensure_ascii=False, indent=2)
    INDICE_JS.parent.mkdir(parents=True, exist_ok=True)
    INDICE_JS.write_text(
        "// GERADO POR scripts/copiar_plantas.py — nao editar a mao.\n"
        "// Corre `python scripts/copiar_plantas.py` para regenerar.\n"
        f"export const PLANTAS = {corpo};\n",
        encoding="utf-8",
    )
    print(f"\nIndice escrito: {INDICE_JS}  ({len(indice)} plantas)")

    # 5) resumo de avisos
    if avisos:
        print("\n=== AVISOS ===")
        for a in avisos:
            print(a)
        return 1
    print("\nTudo copiado sem avisos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
