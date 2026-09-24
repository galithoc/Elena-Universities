---
name: application-wall-chart
description: >-
  Build a printable college-application wall chart for a student: research each
  school's real deadlines and audition/portfolio requirements from official
  pages, compose a checklist of everything they have to do and submit, and
  generate a print-shop-ready SVG and PDF with the school logos across the top
  and write-in space underneath. Works at any trim size (24x36 wall poster,
  11x17 desk copy, letter). Use when someone wants a physical sheet they can
  hang up and tick off, for any student and any list of schools.
---

# application-wall-chart

You are making a thing that goes on a teenager's bedroom wall for eight months.
That sets the standard: every date on it has to be right, it has to still be
true in March, and it has to print at a shop without you there to fix it.

Three phases. Do them in order — the chart is only as good as the research, and
you cannot lay out a checklist before you know what the schools actually ask
for.

**Args:** the student's name, and optionally a trim size (default `36x24`) and
a path to a folder of logo files.

## Before you start

Ask for these four things in one go. Three of them block later phases, so
getting them up front saves a stall halfway through:

1. **The school list.** Names are enough; you will find the rest.
2. **The programme.** BFA dance, music performance, studio art, straight
   academic admission — this decides whether there are auditions, prescreens,
   portfolios or none of the above, and therefore which checklist rows exist.
3. **Logo files.** You cannot fetch these — see the rule below. Ask the person
   to send image files, one per school.
4. **Trim size.** `36x24` is the wall poster. `17x11` is the desk copy. Offer
   both; they cost one extra command.

Anything else — who owns which task, whether they want blank lines — you can
propose from the defaults below and let them correct.

## Phase 1 — research the deadlines

For each school, from that school's **own** pages, not a summary site:

- **Application deadline**, and *which round it is* (ED, EA, RD, rolling).
- **Audition or portfolio deadline and dates**, which are usually different
  from the application deadline and often earlier.
- **Prescreen** requirements and its own deadline, where there is one.
- **The source URL and the date you checked it.**

Record a cycle status for every fact: confirmed for the cycle the student is
applying in, carried over from last cycle, or genuinely not yet published. A
carried-over date on a wall chart is a guess, and it must be labelled as one —
put "2026 date, 2027 TBD" in the round line rather than a bare date that reads
as fact.

**Never assume the round.** This is the single most expensive mistake available
here, and it is not hypothetical — both of these turned up in one nine-school
list:

- Some programmes **offer no Regular Decision at all**. Their early deadline is
  the only door. Put a school like that in the RD column and the student misses
  the school entirely.
- Some tie **money** to the early deadline: apply RD and the first-year merit or
  talent scholarship is simply gone, with nothing on the RD page to say so.

So for every school, check whether RD exists, and check whether scholarship
eligibility has its own earlier date. Then put the deadline the student is
actually working to in the `due` field and name the route in `round` — "Early —
only route", "EA — protects talent aid", "Regular Decision". The round line is
what stops the chart being read as nine interchangeable dates.

**Flag collisions before you draw anything.** Sort the audition dates and look
for the same weekend on two coasts. A wall chart that quietly contains an
impossible pair of dates is worse than no chart, because it looks settled. Say
it out loud: "16–17 January is Los Angeles or Boston, not both."

If a school's site contradicts itself — a portfolio deadline that falls after
the first audition date it gates — say so rather than picking one. Put the
earlier date on the chart and raise the conflict.

## Phase 2 — compose the checklist

Rows are **shared across all schools**: one row, nine boxes. That is the whole
point of the grid — it shows at a glance that six schools have their essays
drafted and three do not. Per-school one-off tasks go in the write-in lines.

This set works for an audition-based programme and is the place to start:

| Row | Owner |
|---|---|
| Supplemental essays drafted | student |
| Recommendations requested | student |
| Prescreen / audition video filmed | student |
| Prescreen / supplement submitted | both |
| Application submitted | both |
| Audition registered | parents |
| Flights / hotel booked | parents |
| Audition completed | student |
| FAFSA / CSS sent to this school | parents |
| Decision received | both |

Adapt it to the programme. No auditions means dropping four of those rows and
overriding `auditionLabel`; a portfolio programme swaps the video rows for
portfolio ones. Keep it to **eight to twelve rows** — past that the boxes get
small and the sheet starts to feel like a debt ledger rather than a map.

Two rules about the rows themselves:

- **Order them the way the work happens**, not by importance. Drafted, then
  submitted, then registered, then travelled, then done. The sheet should read
  top to bottom as the year passes.
- **Owner labels matter more than they look.** Half the value of this chart in a
  real family is that "flights booked" is visibly not the seventeen-year-old's
  job. Keep the owner column.

Leave the write-in block (`blankLines`, default 9) alone unless asked. It is
not filler: it is where the student puts the things you did not know to ask
about, and it is the reason the sheet stays useful in February.

## Phase 3 — produce the chart

Write a spec JSON (see `reference/spec.md`), then:

```bash
pip install Pillow fonttools brotli

python3 scripts/prep_logos.py raw/*.png raw/*.jpg --out logos/
python3 scripts/fetch_fonts.py --out fonts.css
python3 scripts/build_chart.py spec.json --size 36x24 --out chart.svg --fonts fonts.css
node    scripts/svg_to_pdf.js chart.svg 36x24 chart.pdf
```

Send both files. The SVG is what a print shop wants; the PDF is what the person
paying can open and proof themselves.

### The rules that are not obvious

**Logos cannot be fetched.** University sites are blocked here — the network
gateway answers 403 to CONNECT, and no amount of retrying changes it. Ask the
person for image files and wait for them. If files do not arrive, the chart
still builds with a coloured monogram box per school and `build_chart.py` tells
you which ones fell back; say that plainly rather than shipping a sheet that
looks unfinished without explanation.

**Fonts must be embedded or the shop prints Times.** An SVG naming "Fraunces"
gets Fraunces only on a machine that has it installed. `fetch_fonts.py` subsets
nine faces into about 83KB of base64 inside the file. Checking
`document.fonts.check()` does *not* verify this — it reports what is available
locally, not what is in the file. To actually verify, render with the network
blocked; `svg_to_pdf.js` does this and fails loudly if the sheet reaches out.

**Check the PDF measures real inches.** `strings chart.pdf | grep MediaBox`
should read `[0 0 2592 1728]` for 36x24 (72pt to the inch). A sheet that is
secretly 800 pixels wide looks identical on screen and prints as a blurry mess
at any size.

**Proof at letter before anyone pays for large format.** Build the same spec at
`11x8.5`, print it, look at it on paper. Large-format printing is expensive and
slow, and everything wrong with a chart is visible at letter size except the
resolution of the logos.

**Watch the logo resolution.** `prep_logos.py` names any logo that lands under
about 590px wide. Those look perfect on screen and soft on a 36-inch sheet. Ask
for a bigger file or an SVG; if none exists, say the sheet will be slightly soft
in those two columns rather than letting it be a surprise.

**Dates, not countdowns.** The sheet hangs for months. "23 Jan · Tucson" stays
true; "in 41 days" is wrong the next morning. The `asOf` date is what tells
someone in March whether the sheet they are looking at can still be trusted.

## Verify before sending

1. Every deadline traced to the school's own page, with the date you checked it.
2. Every school's round named, and RD confirmed to exist where you claim it.
3. Audition date collisions surfaced in your message, not buried on the sheet.
4. PDF `MediaBox` matches the trim size you promised.
5. `svg_to_pdf.js` reported `rendered offline` — nothing was fetched at render.
6. Embedded fonts are the real ones: `strings chart.pdf | grep BaseFont` should
   name Fraunces, Archivo and IBM Plex Mono, not Liberation or Times.
7. Nothing below 6pt. The floor is enforced in code; if type looks tiny, the
   sheet has too many rows for its size — say so rather than shrinking further.
8. Logos letterboxed, not stretched. Look at the rendering.

## Privacy

A student's school list, deadlines and family task assignments are theirs.
**Do not commit another student's spec, logos or chart into someone else's
repository**, and do not put a name on a public page without being asked. Build
in a scratch directory and send the files; let the person decide where they live.
