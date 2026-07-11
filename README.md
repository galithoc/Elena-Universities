# Elena — Dance Portfolio

A single-page portfolio website for Elena's university dance program applications (BFA/BA), built as a plain static site — no build tools, no frameworks. Designed around what US dance admissions faculty actually look for (sources: USC Kaufman, NYU Tisch, Juilliard, and UNCSA admissions pages, plus faculty interviews in Dance Magazine, Pointe, and Dance Spirit).

The site ships with **clearly-marked placeholders**. Swap them for real content using the checklist below — every placeholder is also marked with a `<!-- PLACEHOLDER: ... -->` comment in `index.html`.

## Publish it (GitHub Pages)

1. On GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick the branch this code is on (e.g. `main`) and folder `/ (root)`, then **Save**.
3. The site goes live in ~1 minute at `https://<username>.github.io/<repo-name>/`.

## Content checklist (all placeholders)

| What | Where |
|---|---|
| Elena's full name | `index.html` — `<title>`, hero heading, clip 3 credit, footer, meta tags |
| Tagline / class year | `index.html` — hero, just under her name |
| Reel video | `index.html` — `#reel` section: replace `PLACEHOLDER_REEL_ID` with the YouTube ID |
| 3 featured clips | `index.html` — `#clips` section: IDs + titles + choreographer/music credits |
| Hero photo | `assets/photos/hero.svg` → replace with a real photo (see specs below) |
| Headshot | `assets/photos/headshot.svg` |
| 8 gallery photos | `assets/photos/gallery-01.svg` … `gallery-08.svg` |
| Bio + quick facts | `index.html` — `#about` section |
| Resume highlights | `index.html` — `#resume` section (Training / Performances / Awards) |
| Resume PDF | `assets/resume/elena-dance-resume.pdf` — replace with her real one-pager |
| Recommendations | `index.html` — `#recommendations` section: 2–3 teacher/mentor quotes + names |
| Email + socials | `index.html` — `#contact` section |
| Share image | `assets/photos/og-image.png` — optional: replace with a 1200×630 photo card |
| Live site URL | `index.html` (canonical + `og:url` + JSON-LD), `robots.txt`, `sitemap.xml` — replace `https://example.com/` everywhere once the site is live |
| Social links (search) | `index.html` — the `sameAs` list in the JSON-LD block, so search engines connect her name to her profiles |

**Swapping a photo:** save the real image as a `.jpg`, drop it in `assets/photos/`, and update the matching `src="assets/photos/..."` in `index.html` (or just name the jpg exactly like the svg it replaces and change the file extension in the HTML).

**Adding a video:** upload to YouTube as **Unlisted** (fine for admissions — it's the standard), copy the ID from the URL (`youtube.com/watch?v=THIS_PART`), and paste it into the matching `data-yt="..."`. For Vimeo use `data-vimeo="VIDEO_ID"` instead. Also swap the thumbnail image (`video-*.svg`) for a still from the video.

## Content tips (from the research)

- **Reel:** 2–3 minutes max, strongest and most recent footage *first* — reviewers decide in seconds. Minimal editing, original audio, full body always in frame, good lighting. Phone-on-tripod footage is fine; clarity beats production value.
- **Credit everything:** choreographer and music for every clip — and triple-check name spellings (misspelled choreographer names actively hurt applicants).
- **Keep one self-choreographed piece** featured — faculty specifically value it as a window into individuality.
- **Photos:** Elena alone, clearly visible; mix technique shots and personality; no group photos.
- **Resume:** one side of one page, curated highlights over exhaustive lists, plain formatting (many schools impose their own template anyway).
- **Remember:** each school's official prescreen still goes through *their* portal (SlideRoom/Acceptd/etc.) per their exact specs. This site is the shareable showcase for everything else — applications, scholarship committees, intensives, teachers, and faculty who look her up.

## When the site is live (one 5-minute pass)

Once GitHub Pages is on and you know the URL (e.g. `https://galithoc.github.io/Elena-Universities/`), search-and-replace `https://example.com/` with it in three files: `index.html`, `robots.txt`, and `sitemap.xml`. That switches on correct social-share previews and search-engine discoverability, so Elena's name surfaces her portfolio when faculty look her up.

## Optional: custom domain

If you buy a domain (e.g. `elenadances.com`):
1. Add a file named `CNAME` in the repo root containing just the domain (`elenadances.com`, no `https://`).
2. In **Settings → Pages → Custom domain**, enter the same domain and save; enable **Enforce HTTPS** once it's ready.
3. At your domain registrar, point the DNS records at GitHub Pages ([GitHub's guide](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site)).
4. Update `https://example.com/` to the new domain in `index.html`, `robots.txt`, and `sitemap.xml`.

## Preview locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

To preview the print/PDF fallback of the resume: open the site, press **Ctrl/Cmd-P**. The nav, hero, videos, and gallery drop away, leaving a clean name-plus-resume printout (a backup for the downloadable PDF).

## Files

```
index.html        the whole site (one page)
css/style.css     design system (includes a print stylesheet)
js/main.js        nav, gallery lightbox, video embeds, scroll reveals
404.html          styled "page not found" (GitHub Pages serves it automatically)
robots.txt        search-engine directives + sitemap pointer
sitemap.xml       single-page sitemap for search engines
site.webmanifest  mobile "add to home screen" metadata
assets/photos/    images (placeholders until replaced)
assets/resume/    downloadable resume PDF
```
