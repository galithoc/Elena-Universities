---
name: refresh-admissions
description: >-
  Re-verify Elena's college admissions facts against each school's official
  pages and update the data (deadlines, auditions, prescreen specs, scholarships,
  aid, costs) with fresh source links, verification dates, and 2027-cycle badges.
  Appends a changelog, regenerates the calendar feed, and validates. Optional
  args: a school slug to refresh just one school, and/or --mode=pr to open a pull
  request instead of committing to the current branch.
---

# refresh-admissions

You are updating the data files for Elena's BFA-dance admissions tracker. Read
`CLAUDE.md` at the repo root first — it is the binding data contract. This skill
is the drill; the weekly GitHub Action runs the exact same steps.

**Args:** an optional school slug (e.g. `usc-kaufman`) limits the run to one
school. `--mode=pr` opens a pull request instead of committing to the current
branch.

## Drill

1. **Scope.** Read `data/meta.json`. Load the target school file(s) — one slug if
   given, else all of `meta.schools`. Build a worklist of URLs = every
   `sources[].url` plus any `fact.sourceUrl` not already covered. Cap fetches at
   ~3–6 pages per school.

2. **Fetch & extract.** WebFetch each source URL. Extract candidate values for
   everything in that source's `checkFor` list, plus anything else matching the
   schema (round deadlines, audition dates/cities/formats, portal, fees, prescreen
   video spec, scholarship dates, aid deadlines, costs, test policy). If a page is
   bot-blocked, note it and rely on visible search-result text, flagging the fact's
   `note` that it needs a browser spot-check.

3. **Diff & update — apply this decision table per Fact:**
   - stored `tbd` or `carried_from_2026`, page shows a value → set `value`,
     `sourceUrl`, `lastVerified` = today. Set `cycleStatus` = `confirmed_2027`
     **only** if the page explicitly ties the value to Fall 2027 / the 2026-27
     cycle / the class entering 2027; otherwise keep `carried_from_2026`.
   - same value re-confirmed → bump `lastVerified` (and upgrade `cycleStatus` if
     the page now makes the cycle explicit).
   - page value **conflicts with a stored `confirmed_2027` value** → DO NOT change
     `value`. Write `pendingChange: {proposedValue, sourceUrl, seenOn: today, note}`
     and add a changelog entry of type `proposed`.
   - an audition that has disappeared from the page → set its `status` to
     `"cancelled"` (never delete it).
   - never invent a URL; only record URLs you actually fetched. When ambiguous,
     prefer `pendingChange` + a `note` quoting the page's wording.

4. **Changelog.** Append one entry per material change to the END of
   `data/changelog.json`'s `entries` array, as a human sentence with `refs` to the
   fact paths touched (e.g. `"auditions.aud-la-jan.date"`). Set `by` to
   `"weekly-refresh"` (Action) or `"manual-refresh"` (interactive).

5. **Stamp.** Update `data/meta.json` `lastRefresh` (`date`, `by`, one-line
   `summary`).

6. **Validate.** Run `python3 scripts/validate.py` — it must exit 0. Fix the data
   (never the validator) until it passes.

7. **Rebuild the feed.** Run `python3 scripts/build_ics.py`.

8. **Ship.**
   - default: commit to the current branch, e.g.
     `refresh: 4 updates — usc-kaufman, pace`.
   - `--mode=pr`: create branch `refresh/YYYY-MM-DD`, push, and open a PR whose
     body is a table of `school | fact | old → new | status`.
   - If nothing material changed: bump only `meta.lastRefresh`, say so, and do not
     open a PR.

## Hard rules

- **Never touch `data/progress.json`** — that is the family's file.
- **Never reuse, renumber, or delete an id.** New things get new ids.
- Serialization: 2-space indent, UTF-8, `ensure_ascii=False`, trailing newline
  (so the diff is minimal). The included Python scripts already do this; match it
  for hand edits.
- Upgrade to `confirmed_2027` only with explicit page evidence. When unsure, keep
  `carried_from_2026` or use `pendingChange`.

## Where new-cycle info tends to land (re-check Aug–Oct 2026)

- **Arizona** — app + audition reg open ~Aug 1 (`dance.arizona.edu/future-students/bfa/apply/`).
- **Chapman** — audition invites go out after the Nov 1 prescreen (~Dec–Feb).
- **SUNY Purchase** — audition dates + deadlines post Aug–Oct; confirm a domestic
  video-audition path by emailing `dance@purchase.edu`.
- **Marymount → Northeastern** — highest-flux: watch `nyc.northeastern.edu`,
  `admissions.northeastern.edu`, and the merger FAQ; expect performing-arts
  application/audition mechanics ~late Aug–Oct. Fastest answer:
  `dancerecruit@mmm.edu` / 212-517-0609.
- **Fordham/Ailey, Tisch, Pace, USC, Boston** — audition dates + refreshed
  deadlines publish across fall; re-verify the `sources[]` for each.
