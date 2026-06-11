# Sittab World Cup 2026 — Bracket Pool Website

7 Sittab colleagues' FIFA World Cup 2026 brackets (originally on
defirate.com), rebuilt as a static site with a leaderboard. User: Filip
Fredling (filip.fredling@sittab.com). Tournament: June 11 – July 19, 2026.

**Status: built and deployed (June 11, 2026).** See README.md for the full
how-to; this file holds context the README doesn't.

## What exists

- Static site (plain HTML/CSS/JS, ES modules, no build): `index.html`
  (leaderboard), `bracket.html?id=<player>` (per-person bracket),
  `results.html` (actual tournament). All logic in `js/engine.js`, tested by
  `scripts/test_engine.mjs` (`npm test`).
- Data in `data/`: `tournament.json` + `brackets.json` (generated from
  `data/raw/` snapshots by `scripts/extract_data.py`), `results.json`
  (hand-edited as matches finish — the README documents the format).
- GitHub Pages deploys via `.github/workflows/pages.yml` (tests, then
  publishes) on push to the deploy branch.

## The recurring task: entering results

The user tells you scores (or edits `data/results.json` directly). Add
entries like `"M5": {"score": [2, 0]}` (knockouts may need
`"pens": [a, b]`), commit, push — the site recomputes everything client-side.
Match codes/schedule: `data/tournament.json`. Tie warnings on the Tournament
page mean an `overrides` entry is needed (rare; README explains).

## Decisions (made with user — do not re-ask)

1. **Scoring**: defirate.com's escalating values, adopted verbatim since
   participants filled brackets under them (group top-2 = 2, advancing 3rd
   = 3, then 4/8/16/24/32 per KO round, bronze game 16; max 360). Group
   top-2 is order-agnostic; a 3rd-place pick must finish exactly 3rd and
   advance; KO pick scores only if the team wins that exact match.
2. **Hosting**: GitHub Pages from this repo.
3. **Results**: manual via `data/results.json`. No live API — explicitly
   declined.
4. **Language**: English.

## Things future sessions should know

- The 7 brackets were fetched 2026-06-11 from
  `https://defirate.com/wp-json/wcb/v1/brackets/<id>` (ids in
  `scripts/extract_data.py`); raw responses live in `data/raw/`. Picks
  locked at noon June 11, so the snapshot is final — never refetch over the
  user's results.
- King John's bracket is slightly incomplete on defirate (missing M90 + M103
  picks); missing picks simply score 0 — by design. Martin's originally
  missing M103 pick was answered by email (Spain) and is applied via
  `MANUAL_PICKS` in `scripts/extract_data.py`; use the same mechanism if
  King John ever supplies his.
- `data/raw/wcb_config.json` carries FIFA's official 495-row third-place
  allocation table (winner_order + table); `js/engine.js` uses it to pair
  best thirds with group winners in the R32. The engine test validates every
  row against the R32 slot constraints.
- Flags are vendored in `assets/flags/` (from flagcdn.com) so the site has
  zero external dependencies.
- The site uses only relative URLs (GitHub Pages subpath:
  `https://ffredling.github.io/Sittab-World-Cup-2026/`).
- Tests double as data validation: every stored KO pick must sit inside that
  player's own predicted matchup (catches extraction or allocation bugs).
- `main` is the long-term branch (created June 11, 2026 from the build
  session's branch, with the user's approval); the Pages workflow deploys
  on pushes to it. Earlier `claude/...` branches are historical session
  branches.
