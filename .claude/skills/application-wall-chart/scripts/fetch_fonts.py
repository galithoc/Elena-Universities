#!/usr/bin/env python3
"""Subset the chart's typefaces and emit @font-face CSS with the fonts inline.

    pip install fonttools brotli
    python3 fetch_fonts.py --out fonts.css

Without this, an SVG naming "Fraunces" gets Fraunces only on a machine that
happens to have it. The print shop's does not, so the sheet silently falls back
to Times and nobody notices until it is on the wall. Subsetting to printable
ASCII plus the punctuation the chart uses takes nine faces to well under 100KB.
"""
import argparse, base64, io, os, re, sys, urllib.parse, urllib.request

# A desktop UA: Google Fonts serves ancient TrueType to anything it doesn't
# recognise, and those blocks have no woff2 URL to fetch.
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/120.0.0.0 Safari/537.36")

# Everything the chart can print. Dashes, the middot used as a separator, and
# curly quotes in school names are easy to forget and show as tofu if omitted.
KEEP = "".join(chr(c) for c in range(0x20, 0x7F)) + "·–—×’‘“”…&°"

FACES = [("Fraunces", 400), ("Fraunces", 600), ("Fraunces", 900),
         ("Archivo", 400), ("Archivo", 500), ("Archivo", 700),
         ("IBM Plex Mono", 400), ("IBM Plex Mono", 500), ("IBM Plex Mono", 700)]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()


def face(family, weight, keep):
    from fontTools.subset import Subsetter, Options
    from fontTools.ttLib import TTFont

    css = get("https://fonts.googleapis.com/css2?family=%s:wght@%d"
              % (urllib.parse.quote(family), weight)).decode()
    # Take the latin block specifically — the full CSS also lists Cyrillic and
    # Vietnamese cuts we would otherwise embed for nothing.
    blocks = re.findall(r"/\*\s*latin\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S)
    if not blocks:
        blocks = re.findall(r"@font-face\s*\{(.*?)\}", css, re.S)
    if not blocks:
        raise RuntimeError(f"no @font-face for {family} {weight}")
    url = re.search(r"url\((https://[^)]+)\)", blocks[0]).group(1)

    f = TTFont(io.BytesIO(get(url)))
    o = Options()
    o.layout_features = ["*"]      # keep kerning: headline type without it looks amateur
    o.notdef_outline = True
    o.desubroutinize = True
    o.flavor = "woff2"
    s = Subsetter(options=o)
    s.populate(text=keep)
    s.subset(f)

    buf = io.BytesIO()
    f.save(buf)
    return buf.getvalue()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="fonts.css")
    ap.add_argument("--text", default=KEEP,
                    help="characters to keep (default: ASCII + chart punctuation)")
    a = ap.parse_args()

    try:
        import fontTools, brotli           # noqa: F401
    except ImportError:
        sys.exit("needs fonttools and brotli:  pip install fonttools brotli")

    out, total = [], 0
    for fam, wt in FACES:
        try:
            woff = face(fam, wt, a.text)
        except Exception as e:
            sys.exit(f"{fam} {wt}: {e}\n"
                     "If this is a network refusal, the sheet still builds — but say\n"
                     "so plainly rather than shipping an SVG that prints as Times.")
        total += len(woff)
        out.append("@font-face{font-family:'%s';font-style:normal;font-weight:%d;"
                   "src:url(data:font/woff2;base64,%s) format('woff2');}"
                   % (fam, wt, base64.b64encode(woff).decode()))
        print(f"  {fam} {wt}  {len(woff)/1024:5.1f}KB")

    with open(a.out, "w", encoding="utf-8") as fh:
        fh.write("".join(out))
    print(f"\n{a.out}  {len(FACES)} faces  {total/1024:.0f}KB "
          f"(~{os.path.getsize(a.out)/1024:.0f}KB as base64 CSS)")


if __name__ == "__main__":
    main()
