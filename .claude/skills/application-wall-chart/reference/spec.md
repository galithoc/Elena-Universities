# The spec file

One JSON object. `schools` and `rows` are required; everything else has a
default. Relative `logo` paths resolve against the directory the spec is in.

## Top level

| Key | Default | What it does |
|---|---|---|
| `title` | `APPLICATION CHECKLIST` | The masthead. Short and in caps — it is set 104 units and a long one will run into the `asOf` stamp. |
| `subtitle` | — | One line under the title. Room for about 90 characters at 36in. |
| `asOf` | — | Stamped top right as `AS OF …`. **Always set it.** It is how someone looking at the sheet in March knows whether to trust it. |
| `dueLabel` | `DEADLINE` | Left-gutter label for the date line. |
| `auditionLabel` | `AUDITION` | Left-gutter label for the third header line. Rename for a non-audition programme (`PORTFOLIO`, `INTERVIEW`) or blank it out. |
| `labelWidth` | `620` | Width of the row-label gutter in design units (100 = 1 inch at 36in wide). Raise it for long row labels, lower it to give narrow columns more room. |
| `blankLines` | `9` | Ruled write-in rows under the grid. They stretch to fill whatever height is left, so a taller sheet means more room to write, not more margin. |
| `blankHeading` | `WHAT THIS SHEET DOESN'T KNOW ABOUT YET` | Heading over the write-in block. |
| `footnote` | — | Small print along the bottom. Good place for "verify anything you are about to spend money on". |

## `schools[]` — one per column

| Key | Required | What it does |
|---|---|---|
| `logo` | no | Path to a PNG, JPEG or SVG. Run it through `prep_logos.py` first. Letterboxed into the header zone, never stretched. |
| `mono` | if no logo | One to three letters for the fallback box. |
| `name` | if no logo | Array of lines under the fallback box, e.g. `["BOSTON","CONSERV."]`. Ignored when a logo is present — the logo carries the name. |
| `color` | `#141310` | The column's rule across the top and the colour of its deadline. Pick from the school's own branding; keep it dark enough to read on white. |
| `due` | no | The deadline, big and in the column colour. `1 NOV`, not `November 1, 2026` — it has to fit a column about 3 inches wide. |
| `round` | no | Which route this deadline is. **The most important small text on the sheet** — see the SKILL's warning about programmes with no RD, and early deadlines that gate scholarship money. |
| `audition` | no | Dates or status: `23 Jan · Tucson`, `Invited · Jan–Mar`, `Video only`. |

Nine columns fit comfortably at 36 inches. Twelve is tight but legible. Past
that, split into two sheets rather than shrinking — `build_chart.py` will warn
you if the columns collapse entirely, but it will not stop you making something
unreadable.

## `rows[]` — one per checklist line

| Key | Required | What it does |
|---|---|---|
| `label` | yes | The task. Same task for every school — that is what makes the grid worth printing. |
| `owner` | no | Small grey text at the right of the gutter: `student`, `parents`, `both`. Worth keeping; it is half the value of the sheet in a real family. |

## Example

`example-spec.json` in this folder is the nine-school BFA dance chart that this
skill was built from — a working spec, with the logo paths it expects.
