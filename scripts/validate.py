#!/usr/bin/env python3
"""Validate the elena-universities data files (stdlib only).

Errors (exit 1) catch anything that would break the app, the ICS feed, or the
refresh contract. Warnings (exit 0) surface staleness/attention items and are
emitted as GitHub Actions annotations when GITHUB_ACTIONS is set.

Usage: python3 scripts/validate.py
"""
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SCHOOLS_DIR = DATA / "schools"

ERRORS = []
WARNINGS = []
IN_ACTIONS = bool(os.environ.get("GITHUB_ACTIONS"))
TODAY = date.today()

CYCLE = {"confirmed_2027", "carried_from_2026", "tbd"}
ROUND_TYPES = {"ED", "ED2", "EA", "REA", "RD", "priority", "rolling", "scholarship_priority"}
AUD_FORMATS = {"in_person", "virtual", "hybrid", "prescreen_only"}
AUD_STATUS = {"tbd", "announced", "open", "registered", "full", "completed", "cancelled"}
CHECK_STATUS = {"todo", "in_progress", "done", "blocked", "na"}
CHECK_OWNER = {"elena", "parents", "both"}
SCHOOL_STATUS = {"active", "applied", "admitted", "denied", "waitlisted", "withdrawn"}
CHANGELOG_TYPES = {"confirmed", "changed", "new", "proposed", "resolved", "added_school", "note"}
DATE_KEYS = {"academicDeadline", "artsSupplementDeadline", "decisionRelease", "deadline",
             "date", "registrationOpens", "registrationDeadline", "priorityDeadline"}
FACT_KEYS = {"value", "sourceUrl", "lastVerified", "cycleStatus"}


def err(msg):
    ERRORS.append(msg)


def warn(msg):
    WARNINGS.append(msg)


def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        err(f"{path.name}: could not parse JSON — {e}")
        return None


def is_fact(v):
    return isinstance(v, dict) and FACT_KEYS.issubset(v.keys())


def parse_iso(s):
    """Return a date for 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM', else None."""
    if not isinstance(s, str):
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def check_fact(ctx, key, fact):
    cs = fact.get("cycleStatus")
    if cs not in CYCLE:
        err(f"{ctx}: cycleStatus '{cs}' not in {sorted(CYCLE)}")
    val = fact.get("value")
    empty = val is None or (isinstance(val, list) and len(val) == 0)
    if cs == "tbd":
        if not empty:
            err(f"{ctx}: cycleStatus 'tbd' but value is not empty ({val!r})")
    else:
        if empty:
            err(f"{ctx}: cycleStatus '{cs}' but value is empty — use 'tbd' or supply a value")
        if not fact.get("sourceUrl"):
            err(f"{ctx}: non-tbd Fact is missing sourceUrl")
    # lastVerified always required and must be a valid, non-future date
    lv = parse_iso(fact.get("lastVerified"))
    if lv is None:
        err(f"{ctx}: lastVerified '{fact.get('lastVerified')}' is not YYYY-MM-DD")
    elif lv > TODAY:
        err(f"{ctx}: lastVerified {lv} is in the future")
    # date-typed fields: value (if present) must be an ISO date
    if key in DATE_KEYS and val is not None:
        if parse_iso(val) is None:
            err(f"{ctx}: date field '{key}' has non-ISO value {val!r}")
    # pendingChange shape
    pc = fact.get("pendingChange")
    if pc is not None:
        if not isinstance(pc, dict) or not {"proposedValue", "sourceUrl", "seenOn"} <= pc.keys():
            err(f"{ctx}: pendingChange must be null or an object with proposedValue/sourceUrl/seenOn")
        elif parse_iso(pc.get("seenOn")) is None:
            err(f"{ctx}: pendingChange.seenOn '{pc.get('seenOn')}' is not YYYY-MM-DD")
    # staleness warnings
    if cs == "confirmed_2027" and lv and (TODAY - lv).days > 45:
        warn(f"{ctx}: confirmed_2027 fact not re-verified in {(TODAY - lv).days} days")


def walk_facts(ctx, key, node):
    """Recursively find and validate every Fact; date-check by parent key."""
    if is_fact(node):
        check_fact(f"{ctx}.{key}" if key else ctx, key, node)
        # a Fact's value may itself hold a list of {id,...} items — check those below
        val = node.get("value")
        if isinstance(val, list):
            _check_item_ids(f"{ctx}.{key}", val)
        return
    if isinstance(node, dict):
        for k, v in node.items():
            walk_facts(ctx, k, v)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk_facts(f"{ctx}[{i}]", key, v)


def _check_item_ids(ctx, items):
    seen = set()
    for it in items:
        if isinstance(it, dict) and "id" in it:
            if it["id"] in seen:
                err(f"{ctx}: duplicate item id '{it['id']}'")
            seen.add(it["id"])


def dup_ids(ctx, items, label):
    seen = set()
    for it in items:
        i = it.get("id")
        if i in seen:
            err(f"{ctx}: duplicate {label} id '{i}'")
        seen.add(i)
    return seen


def check_school(path, meta_ids):
    s = load(path)
    if s is None:
        return
    ctx = path.name
    if s.get("schemaVersion") != 1:
        err(f"{ctx}: unknown schemaVersion {s.get('schemaVersion')}")
    sid = s.get("id")
    stem = path.stem
    if sid != stem:
        err(f"{ctx}: id '{sid}' != filename stem '{stem}'")
    if stem != "_template" and sid not in meta_ids:
        err(f"{ctx}: id '{sid}' not listed in meta.schools")

    for r in s.get("rounds", []):
        if r.get("type") not in ROUND_TYPES:
            err(f"{ctx}: round '{r.get('id')}' type '{r.get('type')}' invalid")
    dup_ids(ctx + " rounds", s.get("rounds", []), "round")

    for a in s.get("auditions", []):
        if a.get("format") not in AUD_FORMATS:
            err(f"{ctx}: audition '{a.get('id')}' format '{a.get('format')}' invalid")
        if a.get("status") not in AUD_STATUS:
            err(f"{ctx}: audition '{a.get('id')}' status '{a.get('status')}' invalid")
    dup_ids(ctx + " auditions", s.get("auditions", []), "audition")
    dup_ids(ctx + " scholarships", s.get("scholarships", []), "scholarship")
    dup_ids(ctx + " sources", s.get("sources", []), "source")

    walk_facts(ctx, "", s)

    # warn: tbd deadline within 60 days for a round Elena may use
    for r in s.get("rounds", []):
        d = parse_iso((r.get("academicDeadline") or {}).get("value"))
        if d and d < TODAY and stem != "_template":
            pass  # past deadlines handled against progress below


def check_meta():
    m = load(DATA / "meta.json")
    if m is None:
        return set()
    ids = m.get("schools", [])
    if len(ids) != len(set(ids)):
        err("meta.json: duplicate ids in schools[]")
    for rk, rv in m.get("regions", {}).items():
        for sid in rv.get("schools", []):
            if sid not in ids:
                err(f"meta.json: region '{rk}' references unknown school '{sid}'")
    return set(ids)


def check_bijection(meta_ids):
    files = {p.stem for p in SCHOOLS_DIR.glob("*.json") if p.stem != "_template"}
    missing = meta_ids - files
    extra = files - meta_ids
    for sid in sorted(missing):
        err(f"meta.schools lists '{sid}' but data/schools/{sid}.json is missing")
    for sid in sorted(extra):
        err(f"data/schools/{sid}.json exists but '{sid}' is not in meta.schools")


def check_progress(meta_ids, round_ids_by_school):
    p = load(DATA / "progress.json")
    if p is None:
        return
    for cid_ctx, items in [("global", p.get("global", {}).get("checklist", []))]:
        dup_ids(f"progress {cid_ctx}", items, "checklist")
        for it in items:
            _check_item(f"progress {cid_ctx}", it)
    for sid, sp in p.get("schools", {}).items():
        if sid not in meta_ids:
            err(f"progress.json: school '{sid}' not in meta.schools")
        st = sp.get("status")
        if st not in SCHOOL_STATUS:
            err(f"progress.json[{sid}]: status '{st}' invalid")
        rc = sp.get("roundChoice")
        if rc is not None and rc not in round_ids_by_school.get(sid, set()):
            err(f"progress.json[{sid}]: roundChoice '{rc}' is not a round id in {sid}.json")
        dup_ids(f"progress[{sid}]", sp.get("checklist", []), "checklist")
        for it in sp.get("checklist", []):
            _check_item(f"progress[{sid}]", it, sid=sid)
        # warn: roundChoice still null after Sept 1, 2026
        if rc is None and TODAY >= date(2026, 9, 1):
            warn(f"progress.json[{sid}]: no round chosen yet (roundChoice is null)")


def _check_item(ctx, it, sid=None):
    if it.get("status") not in CHECK_STATUS:
        err(f"{ctx}: checklist '{it.get('id')}' status '{it.get('status')}' invalid")
    if it.get("owner") not in CHECK_OWNER:
        err(f"{ctx}: checklist '{it.get('id')}' owner '{it.get('owner')}' invalid")
    for dk in ("due", "doneOn"):
        if it.get(dk) is not None and parse_iso(it[dk]) is None:
            err(f"{ctx}: checklist '{it.get('id')}' {dk} '{it[dk]}' is not YYYY-MM-DD")


def check_changelog(meta_ids):
    c = load(DATA / "changelog.json")
    if c is None:
        return
    dup_ids("changelog", c.get("entries", []), "entry")
    for e in c.get("entries", []):
        if e.get("type") not in CHANGELOG_TYPES:
            err(f"changelog '{e.get('id')}': type '{e.get('type')}' invalid")
        if parse_iso(e.get("date")) is None:
            err(f"changelog '{e.get('id')}': date '{e.get('date')}' is not YYYY-MM-DD")
        sc = e.get("school")
        if sc is not None and sc not in meta_ids:
            err(f"changelog '{e.get('id')}': school '{sc}' not in meta.schools")


def cross_checks(meta_ids):
    """Warn on past-dated deadlines whose checklist counterpart isn't done/na."""
    p = load(DATA / "progress.json")
    for sid in meta_ids:
        sfile = SCHOOLS_DIR / f"{sid}.json"
        if not sfile.exists():
            continue
        s = load(sfile)
        sp = (p or {}).get("schools", {}).get(sid, {})
        submitted = {it["id"]: it["status"] for it in sp.get("checklist", [])}
        app_done = submitted.get("app-submitted") in {"done", "na"}
        for r in s.get("rounds", []):
            d = parse_iso((r.get("academicDeadline") or {}).get("value"))
            cs = (r.get("academicDeadline") or {}).get("cycleStatus")
            if d and d < TODAY and cs == "confirmed_2027" and not app_done:
                warn(f"{sid}: confirmed deadline {d} ({r.get('id')}) has passed but 'app-submitted' is not done")


def main():
    meta_ids = check_meta()
    check_bijection(meta_ids)
    round_ids_by_school = {}
    for path in sorted(SCHOOLS_DIR.glob("*.json")):
        s = load(path)
        if s and path.stem != "_template":
            round_ids_by_school[path.stem] = {r.get("id") for r in s.get("rounds", [])}
        check_school(path, meta_ids)
    check_progress(meta_ids, round_ids_by_school)
    check_changelog(meta_ids)
    cross_checks(meta_ids)

    for w in WARNINGS:
        print(f"::warning ::{w}" if IN_ACTIONS else f"WARN  {w}")
    for e in ERRORS:
        print(f"::error ::{e}" if IN_ACTIONS else f"ERROR {e}")

    n_schools = len([p for p in SCHOOLS_DIR.glob("*.json") if p.stem != "_template"])
    print(f"\nvalidate: {n_schools} schools · {len(ERRORS)} error(s) · {len(WARNINGS)} warning(s)")
    sys.exit(1 if ERRORS else 0)


if __name__ == "__main__":
    main()
