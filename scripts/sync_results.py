#!/usr/bin/env python3
"""Sync finished match results from defirate.com into data/results.json.

Run by .github/workflows/sync-results.yml on a schedule (and manually via
`python3 scripts/sync_results.py`). Only matches with status "final" are
ingested. Matches listed in overrides.lockedMatches are never touched, and
the overrides block itself is always left alone.

Exits 0 in all healthy cases; writes `changed=true|false` to $GITHUB_OUTPUT
when running in CI.
"""
import json
import os
import sys
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS_PATH = os.path.join(ROOT, "data", "results.json")
SOURCE_URL = "https://defirate.com/wp-json/wcb/v1/tournament"

# The tournament final is July 19, 2026; stop syncing shortly after.
STOP_AFTER = date(2026, 7, 25)

KNOWN_STATUSES = {"scheduled", "active", "final"}


def set_output(changed):
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")


def main():
    if date.today() > STOP_AFTER:
        print(f"Tournament is over (past {STOP_AFTER}); nothing to sync.")
        set_output(False)
        return

    # defirate's WAF rejects python's default User-Agent.
    req = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": "sittab-bracket-pool/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        remote = json.load(r)

    with open(RESULTS_PATH) as f:
        results = json.load(f)
    matches = results.setdefault("matches", {})
    overrides = results.setdefault("overrides", {})
    locked = set(overrides.get("lockedMatches", []))

    changes = []
    for m in remote["matches"]:
        code = m["match_code"]
        status = m["status"]
        if status not in KNOWN_STATUSES:
            print(f"WARNING: {code} has unknown status {status!r}; skipping.")
            continue
        if status != "final":
            continue
        if m["home_score"] is None or m["away_score"] is None:
            print(f"WARNING: {code} is final but has no score; skipping.")
            continue
        if code in locked:
            continue

        entry = {"score": [int(m["home_score"]), int(m["away_score"])]}
        if m["home_pens"] is not None and m["away_pens"] is not None:
            entry["pens"] = [int(m["home_pens"]), int(m["away_pens"])]

        if matches.get(code) != entry:
            old = matches.get(code)
            matches[code] = entry
            desc = f"{code} {entry['score'][0]}-{entry['score'][1]}"
            if "pens" in entry:
                desc += f" ({entry['pens'][0]}-{entry['pens'][1]} pens)"
            changes.append(desc + (f" (was {old})" if old else ""))

    if not changes:
        print("No new results.")
        set_output(False)
        return

    results["matches"] = dict(
        sorted(matches.items(), key=lambda kv: int(kv[0][1:]))
    )
    with open(RESULTS_PATH, "w") as f:
        json.dump(results, f, indent=1)
        f.write("\n")

    print("Updated:", ", ".join(changes))
    set_output(True)
    # Summary line the workflow uses for the commit message.
    summary = os.environ.get("GITHUB_OUTPUT")
    if summary:
        with open(summary, "a") as f:
            f.write(f"summary={', '.join(c.split(' (was')[0] for c in changes)}\n")


if __name__ == "__main__":
    main()
