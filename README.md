# Elena — Road to the BFA 🩰

A private-feeling, mobile-friendly web app that pulls together **everything**
about the college BFA-dance programs Elena is applying to for **Fall 2027
entry** — application deadlines by round, prescreen/audition requirements,
scholarships & financial aid, essays & recommendations, costs, and a
side-by-side comparison — in one place the whole family can check from their
phones.

It is built to solve one hard problem: **most schools haven't published their
2027-28 details yet** (they roll out Aug–Oct 2026). So every fact carries its
source and a freshness badge — **`2027 ✓`** (confirmed for this cycle),
**last year's date** (carried over, verify), or **TBD** — and an AI refresh keeps
it current as schools update their pages.

## Live site

Once GitHub Pages is enabled (Settings → Pages → Deploy from a branch → `main`
/ root): **https://galithoc.github.io/elena-universities/**

## The nine schools

Fordham/Ailey · NYU Tisch · Pace (Commercial Dance) · University of Arizona ·
Chapman · SUNY Purchase · Boston Conservatory at Berklee · USC Kaufman ·
Marymount → Northeastern University – New York City.

## How it works

- **No build step, no framework.** `index.html` + `assets/app.js` + `assets/app.css`
  fetch plain JSON from `data/` at runtime. Editing data = committing JSON; the
  site updates on the next Pages deploy.
- **`data/schools/*.json`** — one file per school (admissions facts, each with a
  source URL + last-verified date + cycle badge).
- **`data/progress.json`** — the family's own checklist state, round choices, and
  notes. This is the only file the app writes.
- **`data/meta.json` / `data/changelog.json`** — cycle info + a "what's new" feed.
- **`elena-deadlines.ics`** — an auto-generated calendar feed you can **subscribe**
  to from any phone (it updates itself whenever the data changes).

## Keeping it current (the AI part)

- **On demand:** open this repo in a Claude Code session and run
  **`/refresh-admissions`**. It re-checks every school's official pages, updates
  the data with fresh source links and dates, flags anything that changed, and
  regenerates the calendar. Run `/refresh-admissions <school-slug>` for just one.
- **Automatically:** a weekly GitHub Action (`.github/workflows/weekly-refresh.yml`)
  runs the same drill and opens a **pull request** describing what changed, for
  you to review and merge. It needs an `ANTHROPIC_API_KEY` repository secret
  (Settings → Secrets and variables → Actions).
- **Add a school:** run **`/add-school "School Name"`** in a Claude session.

See **`CLAUDE.md`** for the data contract every refresh follows.

## Editing progress from the app

Checklists and notes can be ticked off right in the app and shared with the whole
family. To enable saving, create a fine-grained GitHub token (this repo only,
*Contents: read/write*) and paste it once into the app's ⚙︎ Settings on each
phone. Without a token, the app hands you a ready-to-paste snippet to drop into a
Claude session instead. (The token lives only in your browser; it expires ~July
2027 — after decisions land — so you may need to reissue it if you keep using the
app past then.)

## Verifying locally

```sh
python3 scripts/validate.py        # data integrity (schema, dates, ids)
python3 scripts/build_ics.py       # regenerate elena-deadlines.ics
python3 -m http.server 8000        # then open http://localhost:8000
```

---

*Made with love for Elena. Design system by STEW-ART Designs.*
