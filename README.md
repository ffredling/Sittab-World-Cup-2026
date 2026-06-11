# Sittab World Cup 2026 — Bracket Pool

Static website for the Sittab FIFA World Cup 2026 prediction pool: all 7
brackets, live leaderboard and the actual tournament, served from this repo
via GitHub Pages. No backend, no build step — plain HTML/CSS/JS.

## Pages

- **`index.html`** — leaderboard with per-round point breakdown, "still
  possible" ceiling for each player, and the scoring rules.
- **`bracket.html?id=<player>`** — one participant's full bracket: knockout
  tree, advancing-thirds picks and group predictions, colored against reality.
- **`results.html`** — the actual tournament: group tables, third-place
  ranking and the knockout bracket, all computed from entered match results.

## Updating results (the only recurring task)

Edit [`data/results.json`](data/results.json) and commit. Add one entry per
finished match under `"matches"`, keyed by match code (`M1`–`M104`, see
`data/tournament.json` for the schedule):

```jsonc
{
  "matches": {
    "M1":  { "score": [2, 1] },                  // group match: MEX 2-1 RSA
    "M73": { "score": [1, 1], "pens": [4, 2] }   // knockout decided on penalties
  },
  "overrides": { "groupOrder": {} }
}
```

Everything else is computed automatically: group tables (points → goal
difference → goals scored → head-to-head), the best-thirds ranking, the
Round-of-32 pairings via FIFA's official allocation table, knockout
progression, and all scores.

If a final group order is decided by criteria the site can't know (fair play
points, drawing of lots), the page shows a warning; settle it with an
override, e.g. `"overrides": { "groupOrder": { "A": ["MEX","KOR","RSA","CZE"] } }`.
Same idea for the 8th-vs-9th best third: `"overrides": { "thirdsAdvancing": ["A","B","C","D","E","F","G","H"] }`.

## Scoring

Adopted from defirate.com's published rules — the rules everyone filled their
bracket under. Points escalate per round; maximum 360.

| Pick | Points | Count |
| --- | ---: | ---: |
| Team in its group's top 2 (order-agnostic) | 2 | 24 |
| Third-placed team that advances (must finish 3rd) | 3 | 8 |
| Round of 32 match winner | 4 | 16 |
| Round of 16 winner | 8 | 8 |
| Quarterfinal winner | 16 | 4 |
| Semifinal winner | 24 | 2 |
| Third-place game winner | 16 | 1 |
| Final winner | 32 | 1 |

A knockout pick scores only if the picked team wins that exact match. Missing
picks (two brackets are slightly incomplete) score 0.

## Data

- `data/tournament.json` — teams, all 104 matches, FIFA third-place
  allocation table, scoring values. Generated.
- `data/brackets.json` — the 7 participants' picks. Generated.
- `data/results.json` — actual results, **hand-edited** (see above).
- `data/raw/` — unmodified API snapshots from defirate.com (2026-06-11),
  the provenance for everything above.
- `scripts/extract_data.py` — regenerates the two generated files from
  `data/raw/` (`python3 scripts/extract_data.py`).

## Development

```sh
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # engine tests (standings, allocation, scoring)
```

`js/engine.js` holds all tournament logic and is exercised by
`scripts/test_engine.mjs`, including a validation that every participant's
stored picks are consistent with their own predicted bracket and that all
495 rows of the third-place allocation table satisfy the R32 slot
constraints.

## Deployment

Pushes to the deploy branch run `.github/workflows/pages.yml`, which tests
and publishes the site to GitHub Pages at
<https://ffredling.github.io/Sittab-World-Cup-2026/>.
