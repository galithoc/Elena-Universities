# Handoff — Elena, Road to the BFA

A self-updating tracker for nine dance programs (Fall 2027 entry) — eight BFA plus LMU's BA.
Prepared 2026-08-11 after the first verified end-to-end run; revised 2026-09-11 after a
full audit of the refresh automation.

- **Site:** https://galithoc.github.io/Elena-Universities/
- **Calendar feed:** https://galithoc.github.io/Elena-Universities/elena-deadlines.ics
- **Repo:** https://github.com/galithoc/Elena-Universities (default branch `main`)

Read `CLAUDE.md` first — it is the binding data contract. This file explains how
the system runs and what needs a person.

---

## What's imminent

The automation is healthy again, so the bottleneck is now decisions, not data.
As of 2026-09-11:

| When | What | Why it matters |
|---|---|---|
| **15 days** — 2026-09-26 | Arizona, fall on-campus audition (Tucson) | Earliest in-person option this cycle. **Video-only forfeits first-year Dance Merit talent aid** until year 2 — in-person does not. |
| **28 days** — 2026-10-09 | Arizona Jazz Dance Showcase (Tucson) | Same aid logic; capacity 100, so it can fill. |
| **51 days** — 2026-11-01 | Application deadline for **seven of the nine** | Fordham/Ailey (EA), NYU Tisch (ED), Pace (ED), LMU (ED + EA), Chapman (EA + ED), Arizona (EA). |
| **64 days** — 2026-11-14 | Boston Conservatory on-campus auditions | Live-online alternative on 2026-12-05 may avoid the flight. |
| **81 days** — 2026-12-01 | Pace RD; USC Kaufman priority | |

**No round has been chosen for any of the nine schools** — `roundChoice` is still
`null` everywhere, which the validator reports as nine warnings on every run. That is
the decision gating everything else: ED is binding and can only be used once, EA and
RD are not. Seven of the nine share the same 2026-11-01 date, so the choice cannot be
staggered. Set it on the site's Progress view.

---

## The weekly loop

Only step 4 involves a human.

1. **Monday 10:00 UTC** (6:00 AM Puerto Rico) — the `weekly-refresh` workflow fires.
2. **Claude re-checks all nine schools** — reads each school's stored source URLs,
   updates the data, appends a plain-English changelog, runs the validator until it
   passes, regenerates the ICS. Takes 6–15 minutes.
3. **A pull request appears — only if something changed.** Branch
   `refresh/YYYY-MM-DD`. If nothing material moved, no PR and no noise.
4. **You review and merge.** `data/changelog.json` carries the human summary.
5. **Site + calendars update themselves** via the Pages deploy on merge to `main`.

> **Step 4 is a real dependency, not a formality.** The 2026-08-17 refresh did genuine
> work and opened PR #3 — which then sat unmerged for three weeks. The automation was
> fine; the site was stale the whole time because nobody clicked merge. **An open
> refresh PR means the live site and the family calendar are out of date.** If a PR is
> open on a Monday, merge it that week.

Run it on demand: **Actions → weekly-refresh → Run workflow**, or `/refresh-admissions`
in a Claude session opened on the repo.

---

## Is it actually self-updating? — audited 2026-09-11

Yes, now. It was not between roughly 2026-08-24 and 2026-09-09, and the failure was
invisible: the job finished **green** every Monday while doing nothing at all.

| Run | Date | Duration | What really happened |
|---|---|---|---|
| 8 | 2026-08-11 | 13.6 min | Real pass → PR #2 |
| 9 | 2026-08-17 | 7.8 min | Real pass → PR #3 — *then left unmerged for 3 weeks* |
| 10 | 2026-08-24 | 2.7 min | **Silent no-op** |
| 11 | 2026-08-31 | 3.2 min | **Silent no-op** |
| 12 | 2026-09-07 | 1.8 min | **Silent no-op** |
| 13 | 2026-09-09 | 2.9 min | Silent no-op, but with full logging on — root cause found |
| 14 | 2026-09-09 | 6.0 min | Real pass → PR #4 (USC dates, LMU corrections) |

**Root cause.** The drill was fanning out to nine background subagents — one per school —
and then ending its turn to wait for their completion notifications. Headless inside a
GitHub Action there is no next turn: the runner is torn down the instant the turn ends,
killing all nine before any of them wrote a file. The run's own result line said it
outright: `started_in_background: 9, completed: 0, failed: 0`. The workflow then saw a
clean working tree, correctly reported *"No material changes — no PR opened"*, and
exited green.

**Fix** (commit `86d5179`), in two layers so neither alone has to hold:

1. The prompt opens with a `CRITICAL EXECUTION RULE` — headless, no subagents, no
   ending the turn to wait, do all nine schools inline and sequentially.
2. `claude_args` carries `--disallowedTools "Task"`, so delegation is impossible even
   if the model is inclined to try.

**Verified** by run 14: 6.0 minutes instead of 2.9, and a real PR with real findings —
USC Kaufman's portfolio page back up with new audition dates (2027-01-16/17), and seven
LMU facts corrected against the live page.

**Duration is the tell.** A genuine nine-school pass takes 6–15 minutes. Anything under
about 4 minutes did no work, whatever the checkmark says.

**Still to confirm:** every run since the fix was triggered by hand. The first fully
unattended proof is the scheduled Monday run. Check its duration.

**Note on the PR history:** PRs #1–#4 all show *closed*, not *merged*, on GitHub. Their
content is in `main` — they were squash-merged locally and the PRs closed afterwards,
because the API token available in that session could not merge. Nothing was lost.

---

## Settings that must stay as they are

Each of these, alone, silently breaks the weekly PR — the job reports success while
doing nothing. Every one of them has actually happened at least once. If refreshes stop
appearing, check in this order.

| Setting | Where | Symptom if wrong |
|---|---|---|
| Funded `ANTHROPIC_API_KEY` | Settings → Secrets and variables → Actions | Job fails in ~10s (balance ran out) |
| Actions may create pull requests | Settings → Actions → General → Workflow permissions | Branch pushes, but no PR: *"GitHub Actions is not permitted to create or approve pull requests"* |
| Default branch is `main` | Settings → Branches | Scheduled runs target the wrong branch |
| Tool allowlist in `weekly-refresh.yml` | `claude_args: --allowedTools …` | Run "succeeds" having done nothing — the action denies web access and shell commands by default |
| `--disallowedTools "Task"` **and** the `CRITICAL EXECUTION RULE` prompt preamble | `weekly-refresh.yml` | Run "succeeds" in 2–3 minutes having done nothing — work is delegated to subagents the runner kills on teardown. Do not remove either half. |

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

1. **Choose a round for each school** — see *What's imminent*. Nine `roundChoice`
   values are null and seven deadlines land on the same day.
2. **Arizona: book or skip the in-person audition** — 2026-09-26 or 2026-10-09.
   In-person is the only path to first-year Dance Merit talent aid. This is the only
   open item with a deadline inside a month.
3. **Loyola Marymount (LMU)** — added 2026-09-09, replacing Marymount/Northeastern.
   **LMU awards a BA in Dance, not a BFA** (tracks: Dance; Dance Pedagogy & Social
   Action; Dance Choreography & Performance) — the only non-BFA program on the list,
   worth a deliberate keep-or-drop decision rather than drift. Its audition is
   video-only, requested through the LMU Application Status Portal after applying
   (3-min intro + 2-min solo, no compilations). The 2026-09-09 refresh reached
   `lmu.edu` directly and verified most of its facts, but LMU's pages never tie dates
   to the Fall 2027 cycle, so everything stays `carried_from_2026` by contract.
4. **SUNY Purchase** — on-campus auditions are published (Feb 6/12/20/26 2027) but the
   "alternate arrangements" language is scoped to international applicants. Email
   `dance@purchase.edu` to learn whether a domestic video audition is possible; it
   decides whether a February trip is required.
5. **Fordham** — `fordham.edu` traps the fetcher in a CAS login loop; test policy,
   tuition, and FAFSA/CSS codes need a manual browser check. (The Ailey side verified:
   both applications share the 2026-11-01 deadline, $45 audition fee.)
6. **Boston Conservatory** — every date still `carried_from_2026`. Not yet worrying,
   but its first audition is 2026-11-14, so if the page has not been restated for
   Fall 2027 by mid-October, confirm by phone.

*Resolved since the last handoff:* USC Kaufman's portfolio page is live again with
Fall 2027 audition dates (2027-01-16/17); Marymount/Northeastern's unpublished
post-merger audition mechanics stopped mattering when the school was removed.

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
- **Remove a school** — delete `data/schools/<slug>.json` and its `meta.json` and
  `progress.json` entries, but **do not delete its changelog history**: set those
  entries' `school` to `null` and prefix the text, or the validator fails on the
  orphaned reference. (This is how Marymount/Northeastern was removed.)
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
| No PR on a Monday | Normal if nothing changed — but check the run's **duration**: under ~4 minutes means it did no work |
| Job green in 2–3 minutes | The subagent failure above. Confirm `--disallowedTools "Task"` and the `CRITICAL EXECUTION RULE` preamble are still in `weekly-refresh.yml` |
| Job green, nothing happened | Check `permission_denials_count` in the run result; >0 means the tool allowlist was narrowed |
| Branch pushed, no PR | "Actions may create pull requests" was turned off |
| Job fails in seconds | API balance or key |
| Site shows old dates | Look for an **open** refresh PR first — an unmerged PR is the most likely cause. Then check the `deploy-pages` run |
| A date looks wrong | `data/changelog.json` records what changed and from which source; every fact on the site carries its source link and verification date |
| Validator warns "no round chosen" | Expected until `roundChoice` is set per school — warnings, not errors |
