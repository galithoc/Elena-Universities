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
| Email + socials | `index.html` — `#contact` section |
| Share image | `assets/photos/og-image.png` — optional: replace with a 1200×630 photo card |

**Swapping a photo:** save the real image as a `.jpg`, drop it in `assets/photos/`, and update the matching `src="assets/photos/..."` in `index.html` (or just name the jpg exactly like the svg it replaces and change the file extension in the HTML).

**Adding a video:** upload to YouTube as **Unlisted** (fine for admissions — it's the standard), copy the ID from the URL (`youtube.com/watch?v=THIS_PART`), and paste it into the matching `data-yt="..."`. For Vimeo use `data-vimeo="VIDEO_ID"` instead. Also swap the thumbnail image (`video-*.svg`) for a still from the video.

## Content tips (from the research)

- **Reel:** 2–3 minutes max, strongest and most recent footage *first* — reviewers decide in seconds. Minimal editing, original audio, full body always in frame, good lighting. Phone-on-tripod footage is fine; clarity beats production value.
- **Credit everything:** choreographer and music for every clip — and triple-check name spellings (misspelled choreographer names actively hurt applicants).
- **Keep one self-choreographed piece** featured — faculty specifically value it as a window into individuality.
- **Photos:** Elena alone, clearly visible; mix technique shots and personality; no group photos.
- **Resume:** one side of one page, curated highlights over exhaustive lists, plain formatting (many schools impose their own template anyway).
- **Remember:** each school's official prescreen still goes through *their* portal (SlideRoom/Acceptd/etc.) per their exact specs. This site is the shareable showcase for everything else — applications, scholarship committees, intensives, teachers, and faculty who look her up.

## Preview locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Files

```
index.html        the whole site (one page)
css/style.css     design system
js/main.js        nav, gallery lightbox, video embeds, scroll reveals
assets/photos/    images (placeholders until replaced)
assets/resume/    downloadable resume PDF
```
