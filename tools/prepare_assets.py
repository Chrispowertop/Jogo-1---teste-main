"""
Prepara os assets do jogo (rode uma vez):  python tools/prepare_assets.py
 - recorta os frames irregulares dos sprites (jogador / zumbi) e remonta em
   spritesheets uniformes (96x96, pés alinhados na base)
 - gera collision.json (mar/lagoa + tiles sólidos do tileset de objetos)
"""
import json, sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC = sys.argv[1] if len(sys.argv) > 1 else "uploads"
OUT = "assets"
CELL, COLS, SCALE = 96, 11, 0.40

def detect(path):
    a = np.array(Image.open(path).convert("RGBA"))
    m = a[..., 3] > 40
    lab, n = ndi.label(ndi.binary_dilation(m, iterations=6))
    boxes = []
    for i, s in enumerate(ndi.find_objects(lab)):
        if (m[s] & (lab[s] == i + 1)).sum() < 400: continue
        boxes.append([s[0].start, s[0].stop, s[1].start, s[1].stop])
    boxes.sort(key=lambda b: (b[0] + b[1]) / 2)
    rows, cur = [], [boxes[0]]
    for b in boxes[1:]:
        if (b[0] + b[1]) / 2 - np.mean([(c[0] + c[1]) / 2 for c in cur]) > 110:
            rows.append(cur); cur = []
        cur.append(b)
    rows.append(cur)
    ordered = [b for r in rows for b in sorted(r, key=lambda b: b[2])]
    return Image.fromarray(a), ordered, [len(r) for r in rows]

def pack(path, name):
    im, boxes, rows = detect(path)
    n = len(boxes); R = -(-n // COLS)
    sheet = Image.new("RGBA", (COLS * CELL, R * CELL))
    for i, (y0, y1, x0, x1) in enumerate(boxes):
        c = im.crop((x0, y0, x1, y1))
        c = c.resize((max(1, round(c.width * SCALE)), max(1, round(c.height * SCALE))), Image.LANCZOS)
        px = (i % COLS) * CELL + (CELL - c.width) // 2
        py = (i // COLS) * CELL + CELL - c.height - 3
        sheet.alpha_composite(c, (px, py))
    sheet.save(f"{OUT}/{name}.png")
    print(name, n, "frames; linhas:", rows)
    return rows

prow = pack(f"{SRC}/Folha_de_Sprites_do_Aventureiro_Azul.png", "player")
erow = pack(f"{SRC}/enemy.png", "zombie")
json.dump({"player": prow, "zombie": erow, "cell": CELL, "cols": COLS}, open(f"{OUT}/frames_info.json", "w"))

# ---------- colisão ----------
ground = np.array(Image.open(f"{SRC}/c4026048-0830-44e8-baf0-74045a37362c.png").convert("RGB")).astype(int)
T = 32; W = H = 40
r, g, b = ground[..., 0], ground[..., 1], ground[..., 2]
walk_px = ((g > r + 8) & (g > b + 25)) | ((r > 150) & (g > 105) & (b < 120) & (r > b + 60))
walk_px &= ~((b > g) )
ocean = []
for ty in range(H):
    for tx in range(W):
        f = walk_px[ty*T:(ty+1)*T, tx*T:(tx+1)*T].mean()
        ocean.append(0 if f >= 0.55 else 1)
obj = np.array(Image.open(f"{SRC}/b8f2bb3b-fb48-4515-b115-84d2e2b9460d.png").convert("RGBA"))[..., 3]
cols = 39; solid = []
for lid in range(cols * 39):
    ty, tx = divmod(lid, cols)
    cell = obj[ty*T:(ty+1)*T, tx*T:(tx+1)*T]
    if cell.size and (cell > 40).mean() >= 0.35: solid.append(lid + 1601)
json.dump({"w": W, "h": H, "ocean": ocean, "solidGids": solid}, open(f"{OUT}/collision.json", "w"))
print("tiles bloqueados (mar):", sum(ocean), " gids sólidos:", len(solid))
# overlay de depuração
dbg = Image.open(f"{SRC}/c4026048-0830-44e8-baf0-74045a37362c.png").convert("RGBA")
ov = Image.new("RGBA", dbg.size)
for i, o in enumerate(ocean):
    if o: ov.paste((255, 0, 0, 110), ((i % W)*T, (i // W)*T, (i % W)*T+T, (i // W)*T+T))
Image.alpha_composite(dbg, ov).save("/home/claude/debug_mask.png")
