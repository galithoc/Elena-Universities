#!/usr/bin/env python3
"""Generate elena-deadlines.ics from the data files (stdlib only).

The output is a subscribable calendar feed: deadlines + auditions across all
schools for Elena's chosen (or default) round, as all-day events with -7d/-1d
alarms. Output is DETERMINISTIC (DTSTAMP = each fact's lastVerified, events
sorted), so `--check` can byte-compare the regenerated feed against the
committed file in CI.

collect_items() MUST stay in sync with assets/app.js collectDatedItems() —
same 'kinds' (see CLAUDE.md): app_deadline, supplement_deadline,
audition_registration, audition, scholarship_deadline, aid_deadline, global.

Usage:
  python3 scripts/build_ics.py           # write elena-deadlines.ics
  python3 scripts/build_ics.py --check    # exit 1 if the committed file is stale
"""
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "elena-deadlines.ics"

PREFIX = {"app_deadline": "⏰", "supplement_deadline": "\U0001f3ac",
          "audition_registration": "⏰", "audition": "✈️",
          "scholarship_deadline": "\U0001f4b0", "aid_deadline": "\U0001f4b0",
          "global": "\U0001f4c5"}


def load(name):
    with open(DATA / name, encoding="utf-8") as f:
        return json.load(f)


def parse_iso(s):
    if not isinstance(s, str):
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def fv(fact):
    """A usable dated value: not tbd, value parses as a date. Returns (dt, fact) or None."""
    if not isinstance(fact, dict):
        return None
    if fact.get("cycleStatus") == "tbd" or fact.get("value") is None:
        return None
    dt = parse_iso(fact.get("value"))
    return (dt, fact) if dt else None


def choose_round(school, sp):
    """Elena's chosen round, else the earliest-deadline round."""
    rounds = school.get("rounds", [])
    rc = (sp or {}).get("roundChoice")
    if rc:
        for r in rounds:
            if r.get("id") == rc:
                return r
    dated = [(fv(r.get("academicDeadline")), r) for r in rounds]
    dated = [(x[0][0], x[1]) for x in dated if x[0]]
    if dated:
        return min(dated, key=lambda t: t[0])[1]
    return rounds[0] if rounds else None


def collect_items(meta, schools, progress):
    """Return a flat list of dated calendar items across all schools + globals."""
    items = []
    prog_schools = (progress or {}).get("schools", {})

    def add(school_id, item_id, kind, dt, fact, label, extra=""):
        items.append({
            "uid": f"{school_id}-{item_id}@elena-universities",
            "dt": dt, "kind": kind, "cycleStatus": fact.get("cycleStatus"),
            "dtstamp": fact.get("lastVerified") or meta.get("lastRefresh", {}).get("date"),
            "summary_label": label, "description": extra,
        })

    # global cycle anchors
    cyc = meta.get("cycle", {})
    for key, label in (("commonAppOpens", "Common App opens"), ("fafsaOpens", "FAFSA opens (2027-28)")):
        dt = parse_iso(cyc.get(key))
        if dt:
            items.append({"uid": f"global-{key}@elena-universities", "dt": dt,
                          "kind": "global", "cycleStatus": "confirmed_2027",
                          "dtstamp": meta.get("lastRefresh", {}).get("date"),
                          "summary_label": label, "description": ""})
    # global checklist items with due dates
    for it in (progress or {}).get("global", {}).get("checklist", []):
        dt = parse_iso(it.get("due"))
        if dt and it.get("status") not in ("done", "na"):
            items.append({"uid": f"global-{it['id']}@elena-universities", "dt": dt,
                          "kind": "global", "cycleStatus": "confirmed_2027",
                          "dtstamp": progress.get("updated"),
                          "summary_label": it.get("label", ""), "description": ""})

    for school in schools:
        sid = school["id"]
        short = school.get("shortName", sid)
        sp = prog_schools.get(sid, {})
        rnd = choose_round(school, sp)

        if rnd:
            got = fv(rnd.get("academicDeadline"))
            if got:
                add(sid, f"round-{rnd['id']}-app", "app_deadline", got[0], got[1],
                    f"{short}: {rnd.get('label','Application')} due")

        # school-level artistic-supplement / prescreen deadline
        sup = school.get("artisticSupplement", {})
        got = fv(sup.get("deadline"))
        if got:
            add(sid, "supplement", "supplement_deadline", got[0], got[1],
                f"{short}: prescreen / artistic supplement due")
        elif rnd:
            got = fv(rnd.get("artsSupplementDeadline"))
            if got:
                add(sid, f"round-{rnd['id']}-supp", "supplement_deadline", got[0], got[1],
                    f"{short}: artistic supplement due")

        # auditions (+ their registration deadlines)
        for a in school.get("auditions", []):
            if a.get("status") == "cancelled":
                continue
            got = fv(a.get("date"))
            if got:
                add(sid, a["id"], "audition", got[0], got[1],
                    f"{short}: {a.get('label','Audition')}",
                    a.get("city", ""))
            gotr = fv(a.get("registrationDeadline"))
            if gotr:
                add(sid, f"{a['id']}-reg", "audition_registration", gotr[0], gotr[1],
                    f"{short}: register for {a.get('label','audition')}")

        # scholarships
        for sc in school.get("scholarships", []):
            got = fv(sc.get("deadline"))
            if got:
                add(sid, sc["id"], "scholarship_deadline", got[0], got[1],
                    f"{short}: {sc.get('name','scholarship')} deadline")

        # financial aid priority
        got = fv(school.get("financialAid", {}).get("priorityDeadline"))
        if got:
            add(sid, "aid-priority", "aid_deadline", got[0], got[1],
                f"{short}: FAFSA/CSS priority")

    items.sort(key=lambda it: (it["dt"], it["uid"]))
    return items


def esc(s):
    return (str(s).replace("\\", "\\\\").replace(";", "\\;")
            .replace(",", "\\,").replace("\n", "\\n"))


def fold(line):
    """RFC 5545 folding at 75 octets, without splitting a multibyte char."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    out, cur, first = [], b"", True
    for ch in line:
        b = ch.encode("utf-8")
        limit = 75 if first else 74  # continuation lines start with one space
        if len(cur) + len(b) > limit:
            out.append((b"" if first else b" ") + cur)
            first = False
            cur = b
        else:
            cur += b
    out.append((b"" if first else b" ") + cur)
    return "\r\n".join(x.decode("utf-8") for x in out)


def dtstamp_str(iso_date):
    d = parse_iso(iso_date) or datetime(2026, 1, 1)
    return d.strftime("%Y%m%dT000000Z")


def render(meta, items):
    ics = meta.get("ics", {})
    L = ["BEGIN:VCALENDAR", "VERSION:2.0",
         "PRODID:-//STEW-ART Designs//Elena Road to the BFA//EN",
         "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
         f"X-WR-CALNAME:{esc(ics.get('calName', 'Elena — College Deadlines'))}",
         "X-WR-TIMEZONE:America/Puerto_Rico",
         "X-WR-CALDESC:Deadlines and auditions for Elena's BFA dance applications.",
         "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H"]
    for it in items:
        d = it["dt"]
        start = d.strftime("%Y%m%d")
        end = d.replace(hour=0, minute=0)
        end = (datetime.fromordinal(end.toordinal() + 1)).strftime("%Y%m%d")
        summary = f"{PREFIX.get(it['kind'], '')} {it['summary_label']}".strip()
        if it["cycleStatus"] == "carried_from_2026":
            summary += " [unconfirmed — last year's date]"
        L += ["BEGIN:VEVENT", f"UID:{it['uid']}",
              f"DTSTAMP:{dtstamp_str(it['dtstamp'])}",
              f"DTSTART;VALUE=DATE:{start}", f"DTEND;VALUE=DATE:{end}",
              fold(f"SUMMARY:{esc(summary)}")]
        if it.get("description"):
            L.append(fold(f"DESCRIPTION:{esc(it['description'])}"))
        L.append(f"CATEGORIES:{it['kind']}")
        L.append("TRANSP:TRANSPARENT")
        for trig in ("-P7D", "-P1D"):
            L += ["BEGIN:VALARM", "ACTION:DISPLAY",
                  fold(f"DESCRIPTION:{esc(summary)}"), f"TRIGGER:{trig}", "END:VALARM"]
        L.append("END:VEVENT")
    L.append("END:VCALENDAR")
    return "\r\n".join(L) + "\r\n"


def build():
    meta = load("meta.json")
    schools = [load(f"schools/{sid}.json") for sid in meta["schools"]]
    progress = load("progress.json")
    items = collect_items(meta, schools, progress)
    return render(meta, items), len(items)


def main():
    text, n = build()
    data = text.encode("utf-8")
    if "--check" in sys.argv:
        current = OUT.read_bytes() if OUT.exists() else b""
        if current != data:
            in_actions = any("GITHUB" in k for k in __import__("os").environ)
            print("::error ::elena-deadlines.ics is stale — run: python3 scripts/build_ics.py"
                  if in_actions else
                  "elena-deadlines.ics is STALE. Run: python3 scripts/build_ics.py")
            sys.exit(1)
        print(f"build_ics --check: up to date ({n} events)")
        return
    OUT.write_bytes(data)
    print(f"build_ics: wrote {OUT.name} ({n} events)")


if __name__ == "__main__":
    main()
