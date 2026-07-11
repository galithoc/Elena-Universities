# CLAUDE.md — Data contract for Elena's BFA Dance Admissions Tracker

This repo is a **static GitHub Pages web app** that tracks college BFA-dance
admissions for one applicant (Fall 2027 entry). There is **no build step and no
framework**: `index.html` + `assets/*` render data fetched at runtime from
`data/*.json`. Any Claude session that edits this repo MUST follow the rules
below so the data stays machine-editable, the app keeps working, and
`scripts/validate.py` stays green.

## The two halves (never cross them)

| Data | Who edits it | Files |
|------|--------------|-------|
| **Admissions facts** (deadlines, auditions, aid, program facts) | AI refresh flows + humans via Claude | `data/schools/*.json`, `data/meta.json`, `data/changelog.json` |
| **Family progress** (round choice, checklists, notes) | The app (GitHub API) + humans via Claude | `data/progress.json` |

**Refresh/research flows edit ONLY `data/schools/*`, `data/changelog.json`, and
`data/meta.json` (`lastRefresh`). They must NEVER touch `data/progress.json`.**
The app writes ONLY `data/progress.json`. Keeping this line clean is what lets
the weekly Action and the family edit concurrently without clobbering.

## The `Fact` object — provenance is mandatory

Every dated or externally-sourced leaf value is a `Fact`:

```json
{
  "value": "2027-01-15",
  "sourceUrl": "https://official-page-you-actually-read",
  "lastVerified": "2026-07-10",
  "cycleStatus": "carried_from_2026",
  "note": "optional human context",
  "pendingChange": null
}
```

- `value` — the datum. `null` means unknown (`cycleStatus` must be `tbd`).
- `sourceUrl` — the official page the value came from. **Never invent a URL.**
  Only record URLs you actually fetched.
- `lastVerified` — ISO date you last checked the source. Bump it whenever you
  re-confirm, even if the value did not change.
- `cycleStatus` — one of:
  - `confirmed_2027` — the source page **explicitly** ties this to Fall 2027 /
    the 2026-27 application cycle / class entering 2027. Only then.
  - `carried_from_2026` — a prior-cycle value carried forward (page not yet
    updated). Rendered with an amber "last year's date" badge.
  - `tbd` — nothing published and no reliable prior value; `value` is `null`.
- `note` — optional free text (e.g. quoting the page's exact phrasing).
- `pendingChange` — see the never-silently-change rule below.

A `Fact` wraps **the unit that changes together on one source page** — a scalar
(a date, a fee) or a small list (essay prompts, video-spec lines). Lists inside
a Fact carry stable item `id`s.

## Hard rules (a refresh that breaks one of these is wrong)

1. **Never silently change a `confirmed_2027` value.** If a source now shows a
   different value than a stored `confirmed_2027` Fact, do NOT overwrite
   `value`. Instead set:
   ```json
   "pendingChange": {"proposedValue": "...", "sourceUrl": "...", "seenOn": "2026-10-03", "note": "page now says ..."}
   ```
   and add a `changelog` entry of type `proposed`. A human accepts later by
   moving `proposedValue` into `value`, bumping `lastVerified`, and setting
   `pendingChange` back to `null`.
2. **Never delete facts, rounds, auditions, or ids.** Supersede a value in
   place, or set an audition's `status` to `"cancelled"`. IDs are permanent —
   never reuse, renumber, or delete them (the ICS feed and changelog `refs`
   point at them).
3. **Every material fact change ships a same-commit `changelog` entry.** Append
   to the END of `changelog.json`'s `entries` array (the app sorts newest-first).
   Write it as a human sentence: "Oct 3 — USC posted 2027 audition dates."
4. **Upgrade to `confirmed_2027` only with explicit evidence** (see enum above).
   When in doubt, keep `carried_from_2026` + a `note`, or use `pendingChange`.
5. **`validate.py` must exit 0 before you commit.** Run
   `python3 scripts/validate.py`. Fix the data, never the validator, to make it
   pass.
6. **Regenerate the ICS after any data change:** `python3 scripts/build_ics.py`.

## Serialization (so Python, JS, and hand edits produce identical diffs)

- 2-space indent, UTF-8, non-ASCII kept as-is (`json.dump(..., ensure_ascii=False, indent=2)`).
- Preserve key order; append new list items at the end.
- One trailing newline at end of file.
- Dates are ISO `YYYY-MM-DD`; datetimes `YYYY-MM-DDTHH:MM` with an explicit
  `timezone` (IANA) on the parent object. Countdowns render in
  `America/Puerto_Rico` (AST, UTC−4, no DST).

## The dated-item "kinds" (keep JS and Python in sync)

`assets/app.js` `collectDatedItems()` and `scripts/build_ics.py`
`collect_items()` must extract the SAME set of dated items from a school:
`app_deadline`, `supplement_deadline`, `audition_registration`, `audition`,
`scholarship_deadline`, `aid_deadline`, plus global `global` items from
`meta.json`. If you add a kind, add it in both places.

## Skills

- `/refresh-admissions [slug] [--mode=pr]` — re-verify facts against official
  sources and update them per the rules above. This is the drill the weekly
  GitHub Action also runs.
- `/add-school "<name>"` — scaffold a new school from `data/schools/_template.json`.

## Privacy

The repo is public. Keep it to schedule/status data. **No essay drafts, no
financial-document contents, no login credentials** anywhere in the repo.
