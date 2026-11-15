#!/usr/bin/env python3
"""
KROMMA TECH — tratamento e exportação das fotografias (Etapa 12).

Uso:  python3 tools/otimizar-imagens.py            (a partir da raiz do projeto)

Lê os ORIGINAIS em assets/img/_originais/ (nunca são alterados) e gera em assets/img/:
  <nome>.jpg            JPEG progressivo (fallback)           — largura média
  <nome>-<w>.webp       WebP em vários tamanhos para srcset
  <nome>-<w>.jpg        JPEG em vários tamanhos (fallback do srcset)

O tratamento é conservador e 100% determinístico (sem IA generativa, nada é inventado):
  1. limpeza leve do ruído/blocos de compressão JPEG (mais forte na cor que na luz)
  2. ampliação Lanczos (máx. 2x) — o arquivo enviado pelo cliente é pequeno; isto só suaviza o serrilhado
  3. nitidez por máscara de borda (não amplifica ruído em áreas lisas) + "clareza" de micro-contraste
  4. tom: níveis automáticos limitados, sombras abertas sem lavar o preto, realce protegido (cromados)
  5. cor: vibrance suave (protege vermelhos/brancos); sem trocar cores nem balanço de branco agressivo
"""
import sys, json
from pathlib import Path
import cv2, numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/img/_originais"
OUT = ROOT / "assets/img"

# parâmetros por foto: gamma<1 abre sombras; hi = compressão de realces; vib = vibrance; clahe = força do micro-contraste local
# denoise = intensidade (luz) ; sharp = força da nitidez
P = {
 "expositor-palhetas-rodas":   dict(gamma=.94, hi=.10, vib=.10, clahe=.30, denoise=3, sharp=.75),
 "fachada-kromma-tech":        dict(gamma=.97, hi=.12, vib=.10, clahe=.28, denoise=2, sharp=.70),
 "mecanico-alinhamento-roda":  dict(gamma=.95, hi=.08, vib=.08, clahe=.28, denoise=3, sharp=.75),
 "picape-amarela-4x4-loja":    dict(gamma=.93, hi=.12, vib=.06, clahe=.30, denoise=2, sharp=.70),
 "picape-preta-galpao-pneus":  dict(gamma=.88, hi=.06, vib=.06, clahe=.30, denoise=3, sharp=.75),
 "picape-preta-na-loja":       dict(gamma=.88, hi=.06, vib=.06, clahe=.30, denoise=3, sharp=.75),
 "pneu-etiqueta-vitrine":      dict(gamma=.96, hi=.10, vib=.08, clahe=.30, denoise=3, sharp=.80),
 "pneus-empilhados-na-porta":  dict(gamma=.95, hi=.10, vib=.08, clahe=.30, denoise=3, sharp=.80),
 "pneus-off-road-empilhados":  dict(gamma=.93, hi=.08, vib=.08, clahe=.32, denoise=3, sharp=.80),
 "roda-polida-aro-estudio":    dict(gamma=.95, hi=.14, vib=.04, clahe=.26, denoise=3, sharp=.80),
 "roda-polida-oito-furos":     dict(gamma=.95, hi=.14, vib=.04, clahe=.26, denoise=2, sharp=.75),
 "roda-preta-friso-vermelho":  dict(gamma=.93, hi=.10, vib=.08, clahe=.30, denoise=3, sharp=.80),
 "roda-preta-polida-na-caixa": dict(gamma=.94, hi=.10, vib=.08, clahe=.30, denoise=3, sharp=.80),
 "vitrine-molas-eibach":       dict(gamma=.95, hi=.12, vib=.06, clahe=.28, denoise=3, sharp=.75),
}
WIDTHS = [480, 800, 1200, 1600]   # larguras exportadas (nunca acima do master)
DEFAULT_W = 800                    # largura do <nome>.jpg de fallback
MAX_UP = 2.0

def smoothstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def enhance(bgr, p):
    h, w = bgr.shape[:2]
    # 1) limpeza de compressão (luz leve, cor mais forte)
    bgr = cv2.fastNlMeansDenoisingColored(bgr, None, p["denoise"], 6, 5, 15)
    # 2) ampliação: Lanczos, no máximo 2x
    up = min(MAX_UP, 2400 / max(w, h)) if max(w, h) < 1500 else 1.0
    up = max(up, 1.0)
    if up > 1.0:
        bgr = cv2.resize(bgr, (round(w * up), round(h * up)), interpolation=cv2.INTER_LANCZOS4)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0] / 255., lab[..., 1] - 128., lab[..., 2] - 128.

    # 3) nitidez por máscara de borda + clareza
    g = cv2.GaussianBlur(L, (0, 0), 1.2 * up)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0); gy = cv2.Sobel(g, cv2.CV_32F, 0, 1)
    mag = cv2.GaussianBlur(np.sqrt(gx * gx + gy * gy), (0, 0), 1.5)
    edge = smoothstep(mag, .004, .05)                         # 0 = liso (não mexe), 1 = borda
    fine = L - cv2.GaussianBlur(L, (0, 0), .9 * up)           # detalhe fino
    mid = L - cv2.GaussianBlur(L, (0, 0), 3.0 * up)           # micro-contraste
    L = L + p["sharp"] * edge * fine + .22 * mid * (.4 + .6 * edge)
    L = np.clip(L, 0, 1)

    # 4) tom
    lo, hi = np.percentile(L, .4), np.percentile(L, 99.6)
    lo = min(lo, .06); hi = max(hi, .90)                        # nunca estica mais que ~6%/10%
    L = np.clip((L - lo) / (hi - lo), 0, 1)
    L = L ** p["gamma"]                                         # abre sombras
    # compressão de realces (cromados/branco não estouram)
    k = p["hi"]; L = np.where(L > .78, .78 + (L - .78) * (1 - k * smoothstep(L, .78, 1.0) * 2), L)
    # micro-contraste local (CLAHE misturado)
    cl = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(6, 6)).apply((np.clip(L, 0, 1) * 255).astype(np.uint8)).astype(np.float32) / 255.
    L = (1 - p["clahe"]) * L + p["clahe"] * cl
    L = np.clip((L - .015) / .985, 0, 1)                          # ancora o preto (sem lavar)

    # 5) cor: vibrance protegida (satura mais o que está apagado; preserva já saturados e neutros)
    c = np.sqrt(a * a + b * b)
    gain = 1 + p["vib"] * (1 - np.clip(c / 70., 0, 1)) * smoothstep(c, 2, 14)
    # limpeza de ruído de croma residual
    a = cv2.GaussianBlur(a * gain, (0, 0), .7); b = cv2.GaussianBlur(b * gain, (0, 0), .7)
    out = np.stack([np.clip(L * 255, 0, 255), np.clip(a + 128, 0, 255), np.clip(b + 128, 0, 255)], -1).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_LAB2BGR)

def resize_to(bgr, w):
    h = round(bgr.shape[0] * w / bgr.shape[1])
    interp = cv2.INTER_AREA if w < bgr.shape[1] else cv2.INTER_LANCZOS4
    return cv2.resize(bgr, (w, h), interpolation=interp)

def save(bgr, path, **kw):
    Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).save(path, **kw)

def main():
    if not SRC.exists():
        sys.exit(f"originais não encontrados em {SRC}")
    manifest = {}
    for f in sorted(SRC.glob("*.jpg")):
        name = f.stem
        p = P.get(name, dict(gamma=.95, hi=.10, vib=.08, clahe=.28, denoise=3, sharp=.75))
        bgr = cv2.imread(str(f))
        out = enhance(bgr, p)
        H, W = out.shape[:2]
        ws = sorted({w for w in WIDTHS if w <= W} | ({W} if W < WIDTHS[0] else set()))
        if W > max(ws) and W <= 1700: ws.append(W)
        for w in ws:
            r = resize_to(out, w) if w != W else out
            # leve nitidez final de saída ao reduzir (compensa o filtro de redução)
            if w < W:
                bl = cv2.GaussianBlur(r, (0, 0), .8); r = cv2.addWeighted(r, 1.35, bl, -.35, 0)
            save(r, OUT / f"{name}-{w}.webp", format="WEBP", quality=80, method=6)
            save(r, OUT / f"{name}-{w}.jpg", format="JPEG", quality=84, optimize=True, progressive=True, subsampling="4:2:0")
        dw = min(ws, key=lambda x: abs(x - DEFAULT_W))
        r = resize_to(out, dw) if dw != W else out
        save(r, OUT / f"{name}.jpg", format="JPEG", quality=85, optimize=True, progressive=True, subsampling="4:2:0")
        manifest[name] = dict(w=W, h=H, widths=ws, fallback=dw)
        print(f"{name:30s} {bgr.shape[1]}x{bgr.shape[0]} -> master {W}x{H}  widths={ws}")
    (OUT / "_manifest.json").write_text(json.dumps(manifest, indent=1))

if __name__ == "__main__":
    main()
