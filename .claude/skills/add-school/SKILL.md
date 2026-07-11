---
name: add-school
description: >-
  Add a new college dance program to Elena's tracker. Researches the school's
  official pages, scaffolds a data/schools/<slug>.json from the template with
  proper per-fact provenance, seeds its progress checklist, registers it in
  meta.json, and appends a changelog entry. Arg: the school/program name.
---

# add-school

Add one school to the tracker. Read `CLAUDE.md` first (the data contract).

**Arg:** the school/program name (e.g. `"Point Park University Dance BFA"`).

## Steps

1. **Slug.** Derive a stable kebab-case `slug` (e.g. `point-park`). It becomes the
   file name, the `id`, and the key everywhere.

2. **Scaffold.** Copy `data/schools/_template.json` to `data/schools/<slug>.json`.
   Set `id` = slug.

3. **Research & fill.** Using WebSearch/WebFetch on the school's OFFICIAL pages,
   fill the Facts following the same evidence rules as `refresh-admissions`:
   real `sourceUrl` for every fact, `lastVerified` = today, `cycleStatus` =
   `confirmed_2027` only with explicit 2027 evidence (else `carried_from_2026`,
   or `tbd` with `value: null`). Populate `sources[]` with the official pages to
   re-crawl and their `checkFor` hints. Fill `fit.commercial` / `fit.contemporary`
   (`strong` | `moderate` | `weak`) and a short `fit.note`. Give the school a
   distinct `accent` hex (avoid clashing with existing schools) and a `region`.

4. **Register.** Append the slug to `data/meta.json` `schools[]` (this is both the
   fetch manifest and the display order). Add it to the appropriate
   `meta.regions.<region>.schools[]`, creating a new region entry if needed.

5. **Seed progress.** Add a `data/progress.json` entry under `schools.<slug>` with
   `roundChoice: null`, `status: "active"`, `decision: null`, empty `notes`, and
   the standard 10-item checklist (copy the shape from an existing school:
   supp-essays, recs-requested, prescreen-filmed, prescreen-submitted,
   app-submitted, audition-registered, travel-booked, audition-done, aid-docs,
   decision — each `status: "todo"`).

6. **Changelog.** Append an entry of type `added_school` describing the add.

7. **Validate & build.** Run `python3 scripts/validate.py` (must pass) then
   `python3 scripts/build_ics.py`.

8. **Commit** on the current branch: `add-school: <Name>`.

## Rules

- Never touch other schools' facts. Never delete ids.
- Serialization: 2-space indent, UTF-8, `ensure_ascii=False`, trailing newline.
- If you can't verify a fact, leave it `tbd` — do not guess. The next
  `/refresh-admissions` will fill it in.
