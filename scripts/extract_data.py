#!/usr/bin/env python3
"""Convert raw defirate.com API snapshots (data/raw/) into the site's data files.

Produces:
  data/tournament.json  - teams, matches, third-place allocation, scoring rules
  data/brackets.json    - all participants' picks, keyed by team codes
  data/results.json     - created empty if missing (never overwritten)

Rerunnable: tournament.json and brackets.json are regenerated from data/raw/.
"""
import json
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data")

BRACKETS = [
    "moH0pW2A",
    "l4xeqJGi",
    "C3iwCEcF",
    "Dp9VNCLM",
    "BXCAWDw6",
    "1MBgjZZv",
    "g54pejoi",
]

# Scoring adopted from defirate.com's published rules (escalating per round),
# i.e. the rules participants saw when filling out their brackets.
SCORING = {
    "group_advance": 2,   # team correctly picked to finish top 2 of its group
    "group_third": 3,     # correct 3rd-place team among the 8 that advance
    "r32": 4,             # correct Round of 32 match winner
    "r16": 8,             # correct Round of 16 match winner
    "qf": 16,             # correct Quarterfinal winner
    "sf": 24,             # correct Semifinal winner
    "third": 16,          # correct 3rd-place playoff winner
    "final": 32,          # correct Final winner (champion)
}


def slugify(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s


def load(path):
    with open(os.path.join(RAW, path)) as f:
        return json.load(f)


def main():
    raw_t = load("tournament.json")
    cfg = load("wcb_config.json")

    teams_by_id = {t["id"]: t for t in raw_t["teams"]}
    teams = [
        {
            "code": t["code"],
            "name": t["name"],
            "group": t["group_letter"],
            # flags vendored from flagcdn.com (see t["flag_url"] in data/raw/)
            "flag": f"assets/flags/{t['code']}.png",
            "fifaRank": int(t["fifa_rank"]),
            "color": t["color"],
        }
        for t in sorted(raw_t["teams"], key=lambda t: (t["group_letter"], t["code"]))
    ]

    def code(team_id):
        return teams_by_id[team_id]["code"] if team_id else None

    matches = []
    for m in sorted(raw_t["matches"], key=lambda m: int(m["id"])):
        entry = {
            "code": m["match_code"],
            "stage": m["stage"],
        }
        if m["stage"] == "group":
            entry["group"] = m["group_letter"]
            entry["home"] = code(m["home_team_id"])
            entry["away"] = code(m["away_team_id"])
        else:
            entry["slotHome"] = m["slot_home"]
            entry["slotAway"] = m["slot_away"]
        matches.append(entry)

    tournament = {
        "name": raw_t["tournament"]["name"],
        "source": "defirate.com bracket API snapshot, 2026-06-11",
        "teams": teams,
        "matches": matches,
        "thirdPlace": {
            # winnerOrder[i] is the group whose winner hosts the i-th third-place
            # team of table[<sorted 8 qualifying groups>] in the Round of 32.
            "winnerOrder": cfg["thirdplace"]["winner_order"],
            "table": cfg["thirdplace"]["table"],
        },
        "scoring": SCORING,
    }

    brackets = []
    for public_id in BRACKETS:
        raw_b = load(f"bracket_{public_id}.json")
        name = raw_b["bracket"]["name"]
        picks = raw_b["picks"]

        group_finish = {}
        for p in picks:
            if p["pick_type"] == "group_finish":
                g = p["group_letter"]
                group_finish.setdefault(g, [None, None, None])
                group_finish[g][int(p["rank_position"]) - 1] = code(p["picked_team_id"])

        thirds = sorted(
            p["group_letter"] for p in picks if p["pick_type"] == "third_advances"
        )

        ko_picks = {
            p["match_code"]: code(p["picked_team_id"])
            for p in picks
            if p["pick_type"] == "match"
        }

        champion = next(
            (code(p["picked_team_id"]) for p in picks if p["pick_type"] == "champion"),
            None,
        )

        brackets.append(
            {
                "id": slugify(name),
                "name": name,
                "sourceId": public_id,
                "sourceUrl": f"https://defirate.com/bracket/?bracket={public_id}",
                "complete": bool(raw_b["completeness"]["complete"]),
                "groupFinish": dict(sorted(group_finish.items())),
                "thirdsAdvancing": thirds,
                "koPicks": ko_picks,
                "champion": champion,
            }
        )

    with open(os.path.join(OUT, "tournament.json"), "w") as f:
        json.dump(tournament, f, indent=1, ensure_ascii=False)
    with open(os.path.join(OUT, "brackets.json"), "w") as f:
        json.dump(brackets, f, indent=1, ensure_ascii=False)

    results_path = os.path.join(OUT, "results.json")
    if not os.path.exists(results_path):
        results = {
            "_howto": "Add finished matches under 'matches' keyed by match code "
            "(M1..M104, see data/tournament.json). Group match: "
            '{"score": [home, away]}. Knockout match drawn after 90/120 min: '
            'add "pens": [home, away]. The site computes group tables, '
            "third-place ranking, bracket progression and all points. "
            "Use 'overrides.groupOrder' only if FIFA tiebreakers beyond "
            "points/GD/GF/head-to-head decide a group order, e.g. "
            '{"A": ["MEX", "KOR", "RSA", "CZE"]}.',
            "matches": {},
            "overrides": {"groupOrder": {}},
        }
        with open(results_path, "w") as f:
            json.dump(results, f, indent=1)

    print(f"teams: {len(teams)}, matches: {len(matches)}")
    for b in brackets:
        print(
            f"  {b['id']}: {b['name']!r} champion={b['champion']} "
            f"ko_picks={len(b['koPicks'])} complete={b['complete']}"
        )


if __name__ == "__main__":
    main()
