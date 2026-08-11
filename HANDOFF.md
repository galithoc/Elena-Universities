# Handoff — Elena, Road to the BFA

A self-updating tracker for nine BFA dance programs (Fall 2027 entry).
Prepared 2026-08-11, after the first verified end-to-end run.

- **Site:** https://galithoc.github.io/Elena-Universities/
- **Calendar feed:** https://galithoc.github.io/Elena-Universities/elena-deadlines.ics
- **Repo:** https://github.com/galithoc/Elena-Universities (default branch `main`)

Read `CLAUDE.md` first — it is the binding data contract. This file explains how
the system runs and what needs a person.

---

## The weekly loop

Only step 4 involves a human.

1. **Monday 10:00 UTC** (6:00 AM Puerto Rico) — the `weekly-refresh` workflow fires.
2. **Claude re-checks all nine schools** — reads each school's stored source URLs,
   updates the data, appends a plain-English changelog, runs the validator until it
   passes, regenerates the ICS. Takes 10–15 minutes.
3. **A pull request appears — only if something changed.** Branch
   `refresh/YYYY-MM-DD`. If nothing material moved, no PR and no noise.
4. **You review and merge.** `data/changelog.json` carries the human summary.
5. **Site + calendars update themselves** via the Pages deploy on merge to `main`.

Run it on demand: **Actions → weekly-refresh → Run workflow**, or `/refresh-admissions`
in a Claude session opened on the repo.

---

## Settings that must stay as they are

Each of these, alone, silently breaks the weekly PR — the job reports success while
doing nothing. If refreshes stop appearing, check in this order.

| Setting | Where | Symptom if wrong |
|---|---|---|
| Funded `ANTHROPIC_API_KEY` | Settings → Secrets and variables → Actions | Job fails in ~10s (balance ran out) |
| Actions may create pull requests | Settings → Actions → General → Workflow permissions | Branch pushes, but no PR: *"GitHub Actions is not permitted to create or approve pull requests"* |
| Default branch is `main` | Settings → Branches | Scheduled runs target the wrong branch |
| Tool allowlist in `weekly-refresh.yml` | `claude_args: --allowedTools …` | Run "succeeds" having done nothing — the action denies web access and shell commands by default |

**Architectural rule — do not undo:** Claude in the workflow **only edits files**.
All git and PR work happens in a separate, ordinary workflow step. Claude's sandbox is
walled off from credentials, so having it run `git push` or `gh pr create` fails,
usually silently.

---

## Data invariants

- **Never edit `data/progress.json` by automation** — it is the family's checklist.
- **Never silently overwrite a `confirmed_2027` value** — record a `pendingChange`
  with source and date instead.
- **Never reuse, renumber, or delete an id** — a cancelled audition gets
  `status: "cancelled"`, it is not removed.
- **Only mark `confirmed_2027` with explicit page evidence**, else `carried_from_2026`.
- **The validator is the gate** — fix the data, never loosen `scripts/validate.py`.
- Serialization: 2-space indent, UTF-8, `ensure_ascii=False`, trailing newline.

---

## Open items needing a person

1. **Marymount → Northeastern** — `mmm.edu` now redirects to `nyc.northeastern.edu`,
   which has no dance-audition page yet. An unverified lead (Acceptd portal
   `app.getacceptd.com/mmm`, virtual auditions 2027-01-10 and 2027-02-07) was
   bot-blocked and is deliberately NOT in the data. Confirm in a browser, or contact
   `dancerecruit@mmm.edu` / 212-517-0609.
2. **SUNY Purchase** — on-campus auditions are published (Feb 6/12/20/26 2027) but the
   "alternate arrangements" language is scoped to international applicants. Email
   `dance@purchase.edu` to learn whether a domestic video audition is possible; it
   decides whether a February trip is required.
3. **USC Kaufman** — pages still reference the Fall 2026 cycle, so its deadlines stay
   `carried_from_2026`. The weekly refresh will catch the update; expect it this fall.
4. **Fordham** — `fordham.edu` traps the fetcher in a CAS login loop; test policy,
   tuition, and FAFSA/CSS codes need a manual browser check. (The Ailey side verified:
   both applications share the 2026-11-01 deadline, $45 audition fee.)

---

## Repository map

```
CLAUDE.md              the data contract — binding
PLAN.md                original approved build plan
HANDOFF.md             this file
index.html             app shell
elena-deadlines.ics    generated feed — never hand-edit
assets/                app.js, app.css, fonts.css
data/
  meta.json            student, cycle, school list, regions, lastRefresh
  progress.json        family checklist — automation never touches
  changelog.json       plain-English history
  schools/*.json       nine schools
scripts/
  validate.py          schema + integrity gate; must exit 0
  build_ics.py         regenerates the calendar
.claude/skills/refresh-admissions/SKILL.md
                       the drill — Action and human sessions run identical steps
.github/workflows/
  weekly-refresh.yml   Monday job → opens a PR
  deploy-pages.yml     publishes on push to main
  validate.yml         validator on push
```

---

## Common tasks

- **Change cadence** — edit the `cron` in `weekly-refresh.yml`. During Aug–Oct
  announcement season a second run (`0 10 * * 4`) is reasonable. Times are UTC;
  Puerto Rico is UTC−4 year-round.
- **Hand-edit a fact** — edit the school file, add a `changelog.json` entry with
  `by: "manual-refresh"`, then run `python3 scripts/validate.py` and
  `python3 scripts/build_ics.py` before committing.
- **Add a school** — add the slug to `meta.json` `schools`, create
  `data/schools/<slug>.json` modeled on an existing file, assign a region, validate.
  Candidates discussed but not added: Point Park, UC Irvine, SMU, CalArts.
- **Run locally** — static site, no build step: `python3 -m http.server` and open it.

---

## Cost

The weekly job bills to your own Anthropic API key: roughly **$2–4 per full
nine-school run**, less on quiet weeks — about **$10–16/month** at one run per week.
GitHub Pages and Actions are free at this scale. Set a spend limit and low-balance
alert in the Anthropic console, so a dry balance surfaces as a warning rather than as
months of quietly missing refreshes.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| No PR on a Monday | Normal if nothing changed — verify the run finished green |
| Job green, nothing happened | Check `permission_denials_count` in the run result; >0 means the tool allowlist was narrowed |
| Branch pushed, no PR | "Actions may create pull requests" was turned off |
| Job fails in seconds | API balance or key |
| Site not updating after merge | Check the `deploy-pages` run; Pages can lag a minute |
| A date looks wrong | `data/changelog.json` records what changed and from which source; every fact on the site carries its source link and verification date |
