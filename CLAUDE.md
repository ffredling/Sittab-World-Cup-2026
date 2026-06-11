# Sittab World Cup 2026 — Bracket Pool Website

Handoff notes from the previous Claude Code session (June 11, 2026). Read this
fully before doing anything — all key decisions are already made.

## What this project is

Sittab colleagues (7 people) filled out FIFA World Cup 2026 prediction brackets
on defirate.com, but that site works poorly. The goal: **extract everyone's
brackets and build our own website** showing all brackets, actual tournament
results, and a points leaderboard.

User: Filip Fredling (filip.fredling@sittab.com). Repo:
`ffredling/Sittab-World-Cup-2026`. The tournament started June 11, 2026.

## Current status

- **Nothing is built yet.** The repo contains only this file.
- The previous session was **blocked fetching the bracket data**: the sandbox
  network policy denied requests to defirate.com (`403 Host not in allowlist`,
  from the egress proxy — not the website itself). The user planned to start a
  fresh session with that domain allowed.
- **First task: fetch the 7 brackets below.** If you still get
  `403 Host not in allowlist`, stop and ask the user to add `defirate.com` to
  the environment's allowed network domains (Claude Code on the web →
  environment settings), or to paste the bracket contents / screenshots
  manually instead.

## Source brackets to fetch

- https://defirate.com/bracket/?bracket=moH0pW2A
- https://defirate.com/bracket/?bracket=l4xeqJGi
- https://defirate.com/bracket/?bracket=C3iwCEcF
- https://defirate.com/bracket/?bracket=Dp9VNCLM
- https://defirate.com/bracket/?bracket=BXCAWDw6
- https://defirate.com/bracket/?bracket=1MBgjZZv
- https://defirate.com/bracket/?bracket=g54pejoi

One bracket per person; each person's name should be visible on their bracket
page. If the pages are JavaScript-rendered and the markdown fetch comes back
empty, inspect the page source for an underlying JSON/API endpoint (the
`?bracket=<id>` query param suggests the app loads bracket data by id).

## Decisions already made with the user — do NOT re-ask

1. **Scoring: escalating per round.** Later rounds are worth more points
   (e.g., group-stage/early picks worth least, final worth most). Exact point
   values were NOT fixed yet — choose sensible standard bracket-pool values
   once you see what the brackets actually contain (whether they include
   group-stage predictions or only knockout picks), and document the rules
   clearly on the site/README.
2. **Hosting: GitHub Pages**, served from this repo. Pages may need to be
   enabled in the repo settings (GitHub MCP tools or ask the user).
3. **Results entry: manual via a data file.** Actual match results live in a
   simple committed data file (e.g., `data/results.json`). The user will tell
   the agent the results (or edit the file) and the site recalculates. **No
   live API integration** — explicitly declined.
4. **Language: English.**

## Planned site (agreed with user)

Static site — plain HTML/CSS/JS, no backend (GitHub Pages constraint):

- **Leaderboard** computed from picks vs. actual results using the escalating
  scoring.
- **Per-person bracket view** for each of the 7 participants.
- **Actual results / tournament progress view.**
- Bracket picks and actual results stored as JSON data files in the repo so
  results updates are a simple edit + push.

## Useful tournament facts (WC 2026 format)

- 48 teams, 12 groups (A–L) of 4. Top 2 per group + 8 best third-placed teams
  advance → **Round of 32**, then R16, QF, SF, third-place match, final.
- June 11 – July 19, 2026, hosted by USA/Mexico/Canada. The opening match was
  June 11 — results data starts nearly empty; ask the user for any scores
  already played when setting up `results.json`.
- Take the actual team names/groups from the fetched brackets rather than
  from memory.

## Suggested next steps

1. Fetch all 7 bracket URLs and extract each participant's name + full picks.
2. Define the data schema: `data/brackets/<name>.json` + `data/results.json`
   (+ `data/teams.json` if useful).
3. Build the static site (leaderboard, bracket pages, results page).
4. Decide exact escalating point values; show the scoring rules on the site.
5. Set up GitHub Pages deployment for the repo and give the user the URL.
6. Update this file as the project evolves (data formats, how to update
   results, deploy details).

## Repo/branch note

The repo had zero commits before this file. It was pushed to branch
`claude/exciting-curie-7v3wfl` (the previous session's designated branch),
which GitHub therefore likely treats as the default branch. Your session will
have its own designated branch — branch off this one, and coordinate with the
user about what the long-term default branch should be (e.g., `main`) once the
site exists.
