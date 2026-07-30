"""Gera os ícones do painel ASB a partir do logo oficial (public/asb_logo.png).

Régua de fundo: o logo tem as áreas escuras TRANSPARENTES (alpha 0) — só o vermelho
#C8102E e o branco são opacos. Sobre fundo claro o monograma AS desaparece. Por isso
todo ícone é composto sobre o grafite #15161c (a mesma superfície do painel), que é
também o fundo exigido pelo iOS (apple-touch-icon não suporta transparência).

Enquadramento: o logo NUNCA é cortado — é escalado inteiro e centralizado, com folga
por tipo de ícone. Maskable usa folga maior (safe zone de 80% do Android).
"""
from PIL import Image
import os

REPO = "/Users/cezario/painel-asb-next"
SRC = os.path.join(REPO, "public/asb_logo.png")
GRAFITE = (21, 22, 28)  # #15161c — superfície do painel

logo = Image.open(SRC).convert("RGBA")


def icone(size: int, escala: float, modo="RGB", bg=GRAFITE) -> Image.Image:
    """Logo inteiro, centralizado num quadrado opaco. `escala` = fração do lado ocupada.

    modo="RGBA" mantém o canal alfa (todo opaco) — exigido pelo decodificador de ICO do
    Turbopack, que rejeita frames PNG em RGB. modo="RGB" (sem alfa) para o apple-touch-icon,
    que o iOS espera opaco.
    """
    alvo = size * escala
    w, h = logo.size
    r = min(alvo / w, alvo / h)                       # preserva proporção, nunca corta
    redim = logo.resize((max(1, round(w * r)), max(1, round(h * r))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    canvas.alpha_composite(redim, ((size - redim.width) // 2, (size - redim.height) // 2))
    return canvas if modo == "RGBA" else canvas.convert("RGB")


saidas = []

# ── favicon.ico (multi-size) — App Router serve app/favicon.ico em /favicon.ico
ico_path = os.path.join(REPO, "app/favicon.ico")
base = icone(256, 0.94, modo="RGBA")   # RGBA: o ICO do Turbopack rejeita frames RGB
base.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
saidas.append(("app/favicon.ico", "16·32·48·64·128·256"))

# ── apple-touch-icon — app/apple-icon.png vira <link rel="apple-touch-icon">
# 180x180 é o tamanho pedido pelo iPhone moderno. Opaco (iOS não respeita alpha).
ap = os.path.join(REPO, "app/apple-icon.png")
icone(180, 0.86).save(ap, format="PNG")
saidas.append(("app/apple-icon.png", "180x180 opaco"))

# ── ícones do manifest
d = os.path.join(REPO, "public/icons")
os.makedirs(d, exist_ok=True)
for size in (192, 512):
    icone(size, 0.88).save(os.path.join(d, f"icon-{size}.png"), format="PNG")
    saidas.append((f"public/icons/icon-{size}.png", f"{size}x{size} · purpose any"))
# maskable: conteúdo dentro da safe zone (círculo central de 80%)
for size in (192, 512):
    icone(size, 0.66).save(os.path.join(d, f"icon-maskable-{size}.png"), format="PNG")
    saidas.append((f"public/icons/icon-maskable-{size}.png", f"{size}x{size} · purpose maskable"))

for nome, desc in saidas:
    p = os.path.join(REPO, nome)
    print(f"  {nome:38s} {desc:28s} {os.path.getsize(p)/1024:7.1f} KB")
