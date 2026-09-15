# Handoff — Elena, Road to the BFA

Two pages and a self-updating data pipeline for nine dance programs (Fall 2027 entry) —
eight BFA plus LMU's BA.
Prepared 2026-08-11; revised 2026-09-15 after the first unattended refresh proved the fix holds.

- **The tracker:** https://galithoc.github.io/Elena-Universities/ — schools, deadlines, progress
- **The calendar:** https://galithoc.github.io/Elena-Universities/senior-year.html — her whole year
- **Calendar feed:** https://galithoc.github.io/Elena-Universities/elena-deadlines.ics
- **Repo:** https://github.com/galithoc/Elena-Universities (default branch `main`)

Read `CLAUDE.md` first — it is the binding data contract. This file explains how the system
runs and what needs a person.

---

## Two things need a person right now

**1. PR #7 is open and unmerged.** Monday's refresh did real work and opened it; until it is
merged the live site is one refresh out of date. This is the exact failure that left PR #3
sitting for three weeks in August. Merge it.

It carries a genuine find: **Chapman's Creative Supplement includes a 500-word Goal Statement**
that was not previously captured — a writing task nobody knew about, due 6 November. It also
shifted Chapman's decision estimates (ED I now "mid-December", ED II now "early to mid-February").

**2. Arizona: the 1 November application is now the deadline that matters.**
Elena has chosen the **23 January on-campus audition** in Tucson over the September and October
dates. That is safe on aid: Arizona's Fall 2027 page states applicants *"need to complete their
application by November 1, regardless of their audition date"*, and January is still an
in-person audition, so she keeps first-year Dance Merit eligibility — only video-only auditioners
are excluded until year 2. **The risk moved rather than disappeared:** if the 1 November
application slips, the talent aid goes with it.

Two follow-ups: no registration deadline is published for the January date, unlike the October
showcase which had a hard cutoff and a cap of 100 — confirm with the department. And 23 Jan in
Tucson pairs with Boston Conservatory's Los Angeles audition on 24 Jan: one trip, two schools.

**3. Elena's calendar entries need importing once.** Her hours were first entered in a
throwaway copy of the calendar that has since been retired. Open the calendar →
**Print → Import** → load `elena-calendar-migrate.json`. Until that is done the calendar on the
site is empty of her own data. If the file is lost, the retired page keeps a backup copy.

---

## What's imminent

As of 2026-09-15. The automation is healthy, so the bottleneck is decisions.

| When | What | Why it matters |
|---|---|---|
| **47 days** — Sun 1 Nov | **Seven applications** — including Arizona, which now protects her talent aid | Arizona EA · Boston EA + prescreen · Chapman EA + ED · Fordham/Ailey · LMU EA + ED · NYU ED · Pace ED. Falls on a Sunday. |
| **48 days** — Mon 2 Nov | NYU prescreen, 9:00 ET = **10:00 in San Juan** | US daylight saving ends 1 Nov, so Puerto Rico is an hour ahead. |
| **52 days** — Fri 6 Nov | Chapman Creative Supplement **+ 500-word Goal Statement** | The new find from PR #7. |
| **60 days** — Sat 14 Nov | Boston Conservatory auditions | Fee doubles to $150 after 1 Nov. |
| **77 days** — Tue 1 Dec | Pace RD · USC app + SlideRoom · Boston RD | |

**Six fully free weekends remain before 1 November**: 19–20 and 26–27 Sep, 3–4, 10–11, 17–18
and 24–25 Oct. Against them sits the video work for seven schools. That is the real constraint,
and it is why the calendar counts weekends rather than hours.

Choosing the January audition bought two of those weekends back — the Tucson trip and the day
after the showcase were going to eat 26–27 Sep and 10–11 Oct.

**No application round has been chosen for any of the nine schools.** `roundChoice` is null
everywhere, which the validator reports as nine warnings on every run. ED is binding and can
only be used once; seven of the nine share the same 1 November date, so the choice cannot be
staggered.

---

## The two pages

Both are served from this repo, and they are deliberately separate things.

| | Tracker (`index.html`) | Calendar (`senior-year.html`) |
|---|---|---|
| Answers | What does each school want, and when? | Where does her time actually go? |
| Data | `data/*.json`, refreshed weekly by the Action | Her own entries, in browser storage |
| Edited by | The refresh + the family via Claude | Elena, directly |

The calendar is **not** linked from the tracker's nav, on purpose: the nav's "Calendar" tab is
the deadline agenda, and two things called calendar would be confusing. Reach it by bookmark.

Her calendar entries live in `localStorage` and are **never written to this repo** — it is
public and her daily schedule is not something to publish. Export/Import in the Print panel
moves a calendar between her phone and her laptop as a file.

---

## The weekly loop

Only step 4 involves a human.

1. **Monday, 10:00 UTC** — the `weekly-refresh` workflow fires.
2. **All nine schools get re-checked** against their stored source URLs; data updated, changelog
   appended, validator run until green, ICS regenerated. Takes 6–15 minutes.
3. **A pull request appears — only if something changed.** Branch `refresh/YYYY-MM-DD`.
4. **You review and merge.** `data/changelog.json` carries the plain-English summary.
5. **Site and calendars update themselves** via the Pages deploy on merge to `main`.

> **Step 4 is a real dependency.** An open refresh PR means the live site and the family
> calendar are out of date. If one is open on a Monday, merge it that week.

---

## Is it self-updating? Yes — proved 14 September

It was not, between roughly 24 August and 9 September: the job finished **green every Monday
while doing nothing at all**.

| Run | Date | Trigger | Duration | What happened |
|---|---|---|---|---|
| 9 | 17 Aug | schedule | 7.8 min | Real pass → PR #3, then left unmerged three weeks |
| 10–12 | 24 Aug – 7 Sep | schedule | 1.8–3.2 min | **Silent no-ops** |
| 13 | 9 Sep | manual | 2.9 min | No-op, but with full logging — cause found |
| 14 | 9 Sep | manual | 6.0 min | Real pass → PR #4 |
| **15** | **14 Sep** | **schedule** | **6.2 min** | **Real pass → PR #7 — first unattended proof** |

**What went wrong.** The refresh was fanning out to nine background helpers, one per school, then
ending its turn to wait for them. Running unattended inside a GitHub Action there is no next
turn: the machine is destroyed the instant the turn ends, killing all nine before any wrote a
file. The workflow then correctly saw an unchanged repo, reported *"No material changes — no PR
opened"*, and exited green.

**The fix** (commit `86d5179`), in two layers:
- The prompt opens with a rule that it is running unattended, must not delegate to background
  helpers, and must not end its turn to wait.
- `--disallowedTools "Task"` makes delegation impossible even if it tries.

**How to spot a regression: duration.** A genuine nine-school pass takes 6–15 minutes. Anything
under about four minutes did no work, whatever the green checkmark says.

---

## Settings that must stay as they are

Each of these alone silently breaks the weekly PR — the job reports success while doing nothing.
Every one has actually happened at least once.

| Setting | Where | Symptom if wrong |
|---|---|---|
| Funded `ANTHROPIC_API_KEY` | Settings → Secrets and variables → Actions | Job fails in ~10s (balance ran out) |
| Actions may create pull requests | Settings → Actions → General → Workflow permissions | Branch pushes, but no PR appears |
| Default branch is `main` | Settings → Branches | Scheduled runs target the wrong branch |
| Tool allowlist in `weekly-refresh.yml` | `claude_args: --allowedTools …` | Run "succeeds" having done nothing |
| `--disallowedTools "Task"` **and** the execution-rule preamble | `weekly-refresh.yml` | Run "succeeds" in 2–3 minutes having done nothing. **Do not remove either half.** |

**Architectural rule — do not undo:** in the workflow, Claude **only edits files**. All git and
PR work happens in a separate, ordinary workflow step, because its sandbox is walled off from
credentials — having it run `git push` itself fails, usually silently.

---

## Data invariants

- **Never edit `data/progress.json` by automation** — it is the family's checklist.
- **Never silently overwrite a `confirmed_2027` value** — record a `pendingChange` instead.
- **Never reuse, renumber, or delete an id** — a cancelled audition gets `status: "cancelled"`.
- **Only mark `confirmed_2027` with explicit page evidence**, else `carried_from_2026`.
- **The validator is the gate** — fix the data, never loosen `scripts/validate.py`.
- **Removing a school does not delete its changelog history** — set those entries' `school` to
  `null` rather than stripping them, or the validator fails on the orphaned reference.
- Serialization: 2-space indent, UTF-8, `ensure_ascii=False`, trailing newline.

---

## Open items needing a person

1. **Merge PR #7** and **import the calendar file** — see the top of this document.
2. **Confirm how to register for Arizona's 23 January audition** — no deadline is published for
   that date.
3. **Choose a round for each school** — nine nulls, and seven deadlines on one day.
4. **SUNY Purchase**: is there a video-audition path for a domestic applicant? Email
   `dance@purchase.edu`. It decides whether February means a trip to Westchester. Its artistic
   recommendation must also be emailed by the recommender directly — ask a teacher now.
5. **Fordham**: `fordham.edu` traps the fetcher in a CAS login loop; test policy, tuition and the
   FAFSA/CSS codes still need a manual browser check.
6. **Boston Conservatory**: every date still `carried_from_2026`, and its fee doubles after
   1 Nov. Confirm by phone if the page has not been restated by mid-October.
7. **A data conflict worth verifying**: SUNY Purchase's portfolio deadline (8 Feb) falls *after*
   its earliest audition date (6 Feb), though the portfolio is what unlocks audition signup.

---

## Repository map

```
CLAUDE.md              the data contract — binding
HANDOFF.md             this file
PLAN.md                original approved build plan
index.html             the tracker app shell
senior-year.html       the calendar — standalone, self-contained
elena-deadlines.ics    generated feed — never hand-edit
assets/                app.js, app.css, fonts.css  (tracker only)
data/
  meta.json            student, cycle, school list, regions, lastRefresh
  progress.json        family checklist — automation never touches
  changelog.json       plain-English history
  schools/*.json       nine schools
scripts/
  validate.py          schema + integrity gate; must exit 0
  build_ics.py         regenerates the calendar feed
.claude/skills/refresh-admissions/SKILL.md
                       the drill — Action and human sessions run identical steps
.github/workflows/
  weekly-refresh.yml   Monday job → opens a PR
  deploy-pages.yml     publishes on push to main
  validate.yml         validator on push
```

---

## Common tasks

- **Change cadence** — edit the `cron` in `weekly-refresh.yml`. During Aug–Oct announcement
  season a second run (`0 10 * * 4`) is reasonable. Times are UTC; Puerto Rico is UTC−4.
- **Hand-edit a fact** — edit the school file, add a `changelog.json` entry with
  `by: "manual-refresh"`, then run `python3 scripts/validate.py` and `python3 scripts/build_ics.py`.
- **Add a school** — add the slug to `meta.json` `schools`, create `data/schools/<slug>.json`
  modeled on an existing file, assign a region, validate. Candidates discussed but not added:
  Point Park, UC Irvine, SMU, CalArts.
- **Change the calendar** — `senior-year.html` is one self-contained file with no build step and
  no dependencies on the tracker. Edit and commit.
- **Run locally** — static site: `python3 -m http.server` and open it.

---

## Cost

The weekly job bills to your own Anthropic API key: roughly **$2–4 per full nine-school run**,
about **$10–16/month** at one run per week. GitHub Pages and Actions are free at this scale.
Set a spend limit and low-balance alert in the Anthropic console, so a dry balance surfaces as a
warning rather than as months of quietly missing refreshes.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| No PR on a Monday | Normal if nothing changed — but check the run's **duration**: under ~4 min means it did no work |
| Job green in 2–3 minutes | The delegation failure above. Confirm `--disallowedTools "Task"` and the execution-rule preamble are still in the workflow |
| Job green, nothing happened | Check `permission_denials_count` in the run result; >0 means the tool allowlist was narrowed |
| Branch pushed, no PR | "Actions may create pull requests" was turned off |
| Job fails in seconds | API balance or key |
| Site shows old dates | Look for an **open** refresh PR first — that is the most likely cause. Then check the `deploy-pages` run |
| Calendar is empty | Her entries are per-browser. Import her file, or use Export on the device that has them |
| A date looks wrong | `data/changelog.json` records what changed and from which source; every fact carries its source link and verification date |
| Validator warns "no round chosen" | Expected until `roundChoice` is set per school — warnings, not errors |
