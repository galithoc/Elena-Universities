#!/usr/bin/env python3
"""Turn whatever logo files you were handed into print-ready PNGs.

    pip install Pillow
    python3 prep_logos.py raw/*.png raw/*.jpg --out logos/

School logos arrive as screenshots, webp, transparent PNGs and JPEGs with
compression haze around the letterforms. This normalises all of it: flattened
onto white (the chart's paper), capped at the print resolution of the header
zone, and written as the smaller of a true-colour or palette PNG — because
every byte ends up base64'd inside the SVG, roughly 4/3 its size on disk.
"""
import argparse, os, sys

try:
    from PIL import Image
except ImportError:
    sys.exit("needs Pillow:  pip install Pillow")

# The header zone is about 3in x 1.2in. At 300dpi that is 900 x 360 — more
# pixels than that are thrown away by the printer, so they are pure filesize.
MAXW, MAXH = 900, 360


def prep(path, outdir, maxw, maxh, verbose=True):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    k = min(maxw / w, maxh / h, 1.0)          # never upscale: it only blurs
    if k < 1.0:
        im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)

    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)                    # transparency onto the paper colour
    flat = bg.convert("RGB")

    # JPEG sources ring with off-white speckle around type, which prints as a
    # grey halo on a white sheet. Snap near-white to white.
    if os.path.splitext(path)[1].lower() in (".jpg", ".jpeg"):
        px = flat.load()
        for y in range(flat.height):
            for x in range(flat.width):
                r, g, b = px[x, y]
                if r > 242 and g > 242 and b > 242:
                    px[x, y] = (255, 255, 255)

    name = os.path.splitext(os.path.basename(path))[0] + ".png"
    dest = os.path.join(outdir, name)
    flat.save(dest, "PNG", optimize=True)
    rgb_bytes = os.path.getsize(dest)

    # Most logos are a handful of flat colours; a palette often halves the file.
    pal = flat.convert("P", palette=Image.ADAPTIVE, colors=64)
    tmp = dest + ".pal"
    pal.save(tmp, "PNG", optimize=True)
    if os.path.getsize(tmp) < rgb_bytes:
        os.replace(tmp, dest)
    else:
        os.remove(tmp)

    kb = os.path.getsize(dest) / 1024
    if verbose:
        print(f"{name:34s} {w}x{h} -> {flat.width}x{flat.height}  {kb:6.1f}KB"
              f"  (~{kb * 4 / 3:.0f}KB embedded)")
    return dest, kb


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("files", nargs="+")
    ap.add_argument("--out", default="logos")
    ap.add_argument("--max", default=f"{MAXW}x{MAXH}",
                    help=f"pixel cap WxH (default {MAXW}x{MAXH})")
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    mw, mh = (int(v) for v in a.max.lower().split("x"))

    total, thin = 0.0, []
    for f in a.files:
        dest, kb = prep(f, a.out, mw, mh)
        total += kb
        # 0.7 of the cap is ~630px across a 3in zone, about 210dpi. Below that
        # a logo is visibly soft on a 36in sheet while looking fine on screen.
        if Image.open(dest).width < mw * 0.7:
            thin.append(f"{os.path.basename(dest)} ({Image.open(dest).width}px)")

    print(f"\n{len(a.files)} logos, {total:.0f}KB on disk, "
          f"~{total * 4 / 3:.0f}KB once embedded")
    if thin:
        # Worth saying out loud: it looks fine on screen and soft on the wall.
        print("low resolution for a 36in sheet — ask for a bigger file or an SVG:")
        for t in thin:
            print("  " + t)


if __name__ == "__main__":
    main()
