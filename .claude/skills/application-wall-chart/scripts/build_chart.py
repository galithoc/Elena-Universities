#!/usr/bin/env python3
"""Build a printable application wall chart: schools across, tasks down.

    python3 build_chart.py spec.json --size 36x24 --out chart.svg --fonts fonts.css

Everything the printed file needs travels inside it — logos as base64 PNG,
typefaces as base64 woff2. A chart that references anything over the network
prints wrong at the shop and you do not find out until you collect it.
"""
import argparse, base64, json, os, re, sys

U = 100                             # user units per inch
DESIGN_W = 3600                     # the sheet is drawn 36in wide, then scaled
MIN_PT = 6                          # nothing prints below this, at any size
MIN_U = MIN_PT * U / 72

# Vertical budget in design units. Kept here rather than inline so the scale
# calculation and the drawing cannot disagree about how tall the sheet is.
MARGIN, MAST, RULE_GAP, HDR_GAP = 95, 96, 78, 26
HDR_H, ROW_H, BLANK_HEAD, MIN_LINE, BOT = 320, 86, 68, 52, 110

INK, INK2, MUT = "#141310", "#403B33", "#6E675C"
RULE, RULE2, PAPER, BAND = "#CFC9BB", "#A9A192", "#FFFFFF", "#F6F4EE"
SERIF = "Fraunces, Georgia, 'Times New Roman', serif"
SANS = "Archivo, Helvetica, Arial, sans-serif"
MONO = "'IBM Plex Mono', 'Courier New', monospace"

MIME = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "svg": "image/svg+xml"}


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def data_uri(path):
    ext = os.path.splitext(path)[1].lower().lstrip(".")
    if ext not in MIME:
        sys.exit(f"{path}: unsupported logo format — run prep_logos.py "
                 "(PNG, JPEG and SVG are the printable ones)")
    with open(path, "rb") as fh:
        return "data:%s;base64,%s" % (MIME[ext],
                                      base64.b64encode(fh.read()).decode())


def image_size(path):
    """Intrinsic width/height, so a logo is letterboxed rather than stretched.
    Parsed by hand to keep chart-building free of image libraries."""
    with open(path, "rb") as fh:
        blob = fh.read()

    if blob[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(blob[16:20], "big"), int.from_bytes(blob[20:24], "big")

    if blob[:2] == b"\xff\xd8":                      # JPEG: walk to a SOF marker
        i = 2
        while i + 9 < len(blob):
            if blob[i] != 0xFF:
                i += 1
                continue
            mk = blob[i + 1]
            if 0xC0 <= mk <= 0xCF and mk not in (0xC4, 0xC8, 0xCC):
                return (int.from_bytes(blob[i + 7:i + 9], "big"),
                        int.from_bytes(blob[i + 5:i + 7], "big"))
            i += 2 + int.from_bytes(blob[i + 2:i + 4], "big")
        sys.exit(f"{path}: no JPEG size marker found")

    if b"<svg" in blob[:4096]:
        head = blob[:4096].decode("utf-8", "replace")
        vb = re.search(r'viewBox\s*=\s*["\']\s*[-\d.]+[,\s]+[-\d.]+[,\s]+'
                       r'([\d.]+)[,\s]+([\d.]+)', head)
        if vb:
            return float(vb.group(1)), float(vb.group(2))
        w = re.search(r'\swidth\s*=\s*["\']([\d.]+)', head)
        h = re.search(r'\sheight\s*=\s*["\']([\d.]+)', head)
        if w and h:
            return float(w.group(1)), float(h.group(1))
        sys.exit(f"{path}: SVG has neither viewBox nor plain width/height")

    sys.exit(f"{path}: unrecognised image — run prep_logos.py on it first")


class Sheet:
    """A trim size, and the one scale factor everything is drawn at.

    The chart is 9-ish columns wide by 20-ish rows tall, so it is a landscape
    shape. Rather than centre that shape on whatever paper it is given — which
    wastes half a portrait sheet and shrinks the type for nothing — it scales
    to the width and lets the write-in block grow into the leftover height.
    """

    def __init__(self, w_in, h_in, fontcss, n_rows, n_blanks):
        self.w, self.h = w_in * U, h_in * U
        self.w_in, self.h_in = w_in, h_in

        fixed = (MARGIN + MAST + RULE_GAP + HDR_GAP + HDR_H + n_rows * ROW_H
                 + BLANK_HEAD + n_blanks * MIN_LINE + BOT)
        self.s = min(self.w / DESIGN_W, self.h / fixed)
        self.fits_width = self.w / DESIGN_W <= self.h / fixed

        self.right = DESIGN_W * self.s
        self.ox = (self.w - self.right) / 2      # centre if height is the binding limit
        self.oy = 0                              # top-align: blanks grow downward
        self.bottom = self.h
        self.fontcss, self.parts = fontcss, []

    def f(self, n):
        return max(MIN_U, n * self.s)

    def text(self, x, y, t, size, weight=400, fill=INK, anchor=None,
             family=SANS, spacing=None):
        self.parts.append(
            '<text x="%.1f" y="%.1f" font-size="%.1f" font-weight="%s" fill="%s"%s%s '
            'font-family="%s">%s</text>' % (
                x, y, size, weight, fill,
                ' text-anchor="%s"' % anchor if anchor else "",
                ' letter-spacing="%.2f"' % spacing if spacing else "",
                family, esc(t)))

    def rect(self, x, y, w, h, fill, stroke=None, sw=0):
        self.parts.append(
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"%s/>' % (
                x, y, w, h, fill,
                ' stroke="%s" stroke-width="%.2f"' % (stroke, sw) if stroke else ""))

    def line(self, x1, y1, x2, y2, stroke, sw):
        self.parts.append(
            '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
            'stroke-width="%.2f"/>' % (x1, y1, x2, y2, stroke, sw))

    def image(self, x, y, w, h, uri):
        self.parts.append('<image x="%.1f" y="%.1f" width="%.1f" height="%.1f" '
                          'href="%s"/>' % (x, y, w, h, uri))

    def render(self, label):
        defs = ('<defs><style type="text/css">%s</style></defs>' % self.fontcss
                if self.fontcss else "")
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            'width="%gin" height="%gin" viewBox="0 0 %g %g" role="img" aria-label="%s">'
            '%s<rect x="0" y="0" width="%g" height="%g" fill="%s"/>'
            '<g transform="translate(%.1f,%.1f)">%s</g></svg>\n' % (
                self.w_in, self.h_in, self.w, self.h, esc(label), defs,
                self.w, self.h, PAPER, self.ox, self.oy, "".join(self.parts)))


def build(spec, w_in, h_in, fontcss, base_dir):
    schools, rows = spec["schools"], spec["rows"]
    blanks = int(spec.get("blankLines", 9))
    n = len(schools)
    if not n:
        sys.exit("spec has no schools")

    sh = Sheet(w_in, h_in, fontcss, len(rows), blanks)
    s, f = sh.s, sh.f

    m = MARGIN * s
    lab_w = float(spec.get("labelWidth", 620)) * s
    grid_x = m + lab_w
    cw = (sh.right - m - grid_x) / n
    if cw <= 0:
        sys.exit(f"{n} schools do not fit beside a {spec.get('labelWidth', 620)}-unit "
                 "label column — widen the sheet or lower labelWidth")

    # masthead
    y = m + MAST * s
    sh.text(m, y, spec.get("title", "APPLICATION CHECKLIST"), f(104), 900, INK,
            None, SERIF, -1.2 * s)
    if spec.get("subtitle"):
        sh.text(m, y + 46 * s, spec["subtitle"], f(30), 400, MUT)
    if spec.get("asOf"):
        sh.text(sh.right - m, y, "AS OF " + spec["asOf"].upper(), f(26), 500,
                MUT, "end", MONO, 1.6 * s)
    y += RULE_GAP * s
    sh.line(m, y, sh.right - m, y, INK, 5 * s)

    # column headers — one fixed-height zone so every header shares a baseline
    hdr_top, hdr_h = y + HDR_GAP * s, HDR_H * s
    zone_t, zone_h = hdr_top + 30 * s, 150 * s
    for i, sc in enumerate(schools):
        x = grid_x + i * cw
        colour = sc.get("color", INK)
        sh.rect(x, hdr_top, cw, 13 * s, colour)
        logo = sc.get("logo")
        if logo:
            path = logo if os.path.isabs(logo) else os.path.join(base_dir, logo)
            lw, lh = image_size(path)
            k = min((cw - 30 * s) / lw, zone_h / lh)    # letterbox, never distort
            sh.image(x + cw / 2 - lw * k / 2, zone_t + zone_h / 2 - lh * k / 2,
                     lw * k, lh * k, data_uri(path))
        else:
            box = 84 * s
            sh.rect(x + cw / 2 - box / 2, zone_t + 2 * s, box, box, PAPER, colour, 2.6 * s)
            sh.text(x + cw / 2, zone_t + 2 * s + box * 0.70, sc.get("mono", "?"),
                    f(40), 700, colour, "middle", SANS, -0.5 * s)
            names = sc.get("name", [])
            for j, ln in enumerate(names):
                sh.text(x + cw / 2, zone_t + 108 * s + j * 30 * s, ln,
                        f(25) if len(names) > 1 else f(29), 700, INK, "middle",
                        SANS, 1.1 * s)
        dy = zone_t + zone_h + 34 * s
        if sc.get("due"):
            sh.text(x + cw / 2, dy, sc["due"], f(34), 900, colour, "middle", SERIF)
        if sc.get("round"):
            sh.text(x + cw / 2, dy + 26 * s, sc["round"], f(17), 500, MUT, "middle")
        if sc.get("audition"):
            sh.text(x + cw / 2, dy + 50 * s, sc["audition"], f(17), 400, INK2,
                    "middle", MONO)
        if i:
            sh.line(x, hdr_top, x, hdr_top + hdr_h, RULE, 1.2 * s)
    sh.text(m, hdr_top + hdr_h - 58 * s, spec.get("dueLabel", "DEADLINE"),
            f(20), 700, MUT, None, MONO, 1.8 * s)
    sh.text(m, hdr_top + hdr_h - 30 * s, spec.get("auditionLabel", "AUDITION"),
            f(20), 700, MUT, None, MONO, 1.8 * s)

    gy = hdr_top + hdr_h
    sh.line(m, gy, sh.right - m, gy, INK, 3.4 * s)

    # the tick matrix
    row_h, box = ROW_H * s, 34 * s
    for i, r in enumerate(rows):
        ry = gy + i * row_h
        if i % 2:
            sh.rect(m, ry, sh.right - 2 * m, row_h, BAND)
        sh.text(m + 8 * s, ry + row_h * 0.63, r["label"], f(27), 500)
        if r.get("owner"):
            sh.text(m + lab_w - 22 * s, ry + row_h * 0.63, r["owner"], f(17), 400,
                    "#A9A192", "end", MONO, 1 * s)
        for j in range(n):
            cx = grid_x + j * cw + cw / 2
            sh.rect(cx - box / 2, ry + row_h / 2 - box / 2, box, box, PAPER, RULE2, 2.2 * s)
        sh.line(m, ry + row_h, sh.right - m, ry + row_h, RULE, 1.4 * s)
    by = gy + len(rows) * row_h
    for i in range(1, n):
        sh.line(grid_x + i * cw, gy, grid_x + i * cw, by, RULE, 1.4 * s)
    sh.line(grid_x, gy, grid_x, by, RULE2, 2.2 * s)

    # Ruled space for whatever the chart does not know about. It takes all the
    # height left over, which is what makes an odd trim size usable rather than
    # merely safe — a taller sheet becomes more room to write, not more margin.
    drawn = 0
    if blanks:
        by += 46 * s
        sh.text(m, by, spec.get("blankHeading", "WHAT THIS SHEET DOESN'T KNOW ABOUT YET"),
                f(26), 700, INK, None, MONO, 2.2 * s)
        by += 22 * s
        avail = (sh.bottom - BOT * s) - by
        line_h = max(MIN_LINE * s, avail / blanks)
        for i in range(blanks):
            ly = by + (i + 1) * line_h
            if ly > sh.bottom - BOT * 0.8 * s:
                break
            sh.line(m, ly, sh.right - m, ly, RULE, 1.6 * s)
            for j in range(n):
                cx = grid_x + j * cw + cw / 2
                sh.rect(cx - box / 2, ly - line_h * 0.5 - box / 2 + 6 * s, box, box,
                        PAPER, "#DCD6C8", 1.8 * s)
            drawn = i + 1
        if drawn:
            span = min(drawn * line_h, avail)
            for i in range(1, n):
                sh.line(grid_x + i * cw, by, grid_x + i * cw, by + span, RULE, 1.4 * s)
            sh.line(grid_x, by, grid_x, by + span, RULE2, 2.2 * s)

    if spec.get("footnote"):
        sh.text(m, sh.bottom - BOT * 0.38 * s, spec["footnote"], f(21), 400, MUT)

    return sh.render(spec.get("title", "wall chart")), sh, drawn


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("spec")
    ap.add_argument("--size", default="36x24", help="inches, WxH (default 36x24)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--fonts", help="CSS of @font-face rules to embed (fetch_fonts.py)")
    a = ap.parse_args()

    spec = json.load(open(a.spec, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(a.spec))
    try:
        w, h = (float(v) for v in a.size.lower().split("x"))
    except ValueError:
        sys.exit(f"--size wants inches as WxH, e.g. 36x24 (got {a.size!r})")

    fontcss = ""
    if a.fonts:
        fontcss = open(a.fonts, encoding="utf-8").read()
    else:
        print("  ! no --fonts: this will print in whatever the shop has installed, "
              "which is not Fraunces", file=sys.stderr)

    svg, sh, drawn = build(spec, w, h, fontcss, base)
    with open(a.out, "w", encoding="utf-8") as fh:
        fh.write(svg)

    want = int(spec.get("blankLines", 9))
    print("%s  %gx%gin  %d schools (%d with logos)  %d rows + %d write-in  %dKB"
          % (a.out, w, h, len(spec["schools"]),
             sum(1 for sc in spec["schools"] if sc.get("logo")),
             len(spec["rows"]), drawn, len(svg.encode()) // 1024))

    missing = [sc.get("mono") or (sc.get("name") or ["?"])[0]
               for sc in spec["schools"] if not sc.get("logo")]
    if missing:
        print("  ! monogram fallback still on: " + ", ".join(missing))
    if drawn < want:
        print(f"  ! only {drawn} of {want} write-in lines fit — taller sheet or fewer rows")
    if not sh.fits_width:
        print("  ! sheet is short for this many rows; it is centred with side margins")


if __name__ == "__main__":
    main()
