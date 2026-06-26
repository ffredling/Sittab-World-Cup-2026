#!/usr/bin/env node
// Sync match results from ESPN's public Soccer API into data/results.json.
//
// Replaces the earlier defirate sync (defirate lagged a day behind reality).
// ESPN tracks the same tournament (verified: identical groups, teams, and
// scores) but updates live. Run by .github/workflows/sync-results.yml on a
// schedule, or manually: `node scripts/sync_results.mjs`.
//
// Mapping is by team identity (ESPN's 3-letter abbreviations are identical to
// our FIFA codes for all 48 teams): group matches map by their unordered team
// pair; knockout matches map by the teams the engine resolves into each slot.
// Scores are oriented to OUR home/away by team, so ESPN's home/away choice
// never matters. Matches listed in overrides.lockedMatches are never touched.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeActual } from "../js/engine.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS_PATH = join(ROOT, "data", "results.json");
const SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

// Tournament window (UTC dates). Stop syncing shortly after the final.
const FIRST_DAY = Date.UTC(2026, 5, 11); // 2026-06-11
const STOP_AFTER = Date.UTC(2026, 6, 26); // 2026-07-26

const tournament = JSON.parse(
  readFileSync(join(ROOT, "data", "tournament.json"), "utf8")
);
const ourCodes = new Set(tournament.teams.map((t) => t.code));

// Group match lookup keyed by the unordered pair of team codes.
const groupByPair = new Map();
for (const m of tournament.matches) {
  if (m.stage === "group") {
    groupByPair.set([m.home, m.away].sort().join("|"), m);
  }
}
const koMatches = tournament.matches.filter((m) => m.stage !== "group");

function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

function ymd(ms) {
  const d = new Date(ms);
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

async function fetchDay(dateStr) {
  const url = `${SCOREBOARD}?dates=${dateStr}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "sittab-bracket-pool/1.0" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === 2) {
        console.error(`WARN: ${dateStr} fetch failed (${e.message}); skipping`);
        return { events: [] };
      }
      await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
    }
  }
}

// Pull every finished match from ESPN across the tournament window.
async function collectFinals() {
  const finals = []; // { isGroup, pair:[a,b], goals:{code:n}, pens:{code:n}|null }
  const end = Math.min(Date.now() + 86400000, STOP_AFTER); // today (+1d slack)
  for (let t = FIRST_DAY; t <= end; t += 86400000) {
    const data = await fetchDay(ymd(t));
    for (const ev of data.events || []) {
      const comp = ev.competitions?.[0];
      const st = ev.status?.type;
      if (!comp || !st?.completed || st.state !== "post") continue;

      const sides = comp.competitors.map((c) => ({
        code: c.team?.abbreviation,
        goals: c.score === "" || c.score == null ? null : Number(c.score),
        pens:
          c.shootoutScore === "" || c.shootoutScore == null
            ? null
            : Number(c.shootoutScore),
      }));
      if (sides.length !== 2) continue;
      for (const s of sides) {
        if (!ourCodes.has(s.code)) {
          throw new Error(
            `ESPN team code '${s.code}' not in our tournament — mapping must be fixed before trusting the sync`
          );
        }
        if (s.goals == null || Number.isNaN(s.goals)) {
          throw new Error(`ESPN match ${ev.name} is post but has no score`);
        }
      }
      const goals = Object.fromEntries(sides.map((s) => [s.code, s.goals]));
      const hasPens = sides.every((s) => s.pens != null);
      const pens = hasPens
        ? Object.fromEntries(sides.map((s) => [s.code, s.pens]))
        : null;
      finals.push({
        isGroup: (ev.season?.slug || "").includes("group"),
        pair: sides.map((s) => s.code),
        goals,
        pens,
        date: ev.date,
      });
    }
  }
  return finals;
}

function entryFor(home, away, f) {
  const e = { score: [f.goals[home], f.goals[away]] };
  if (f.pens) e.pens = [f.pens[home], f.pens[away]];
  if (f.date) e.date = f.date;
  return e;
}

async function main() {
  if (Date.now() > STOP_AFTER) {
    console.log("Tournament over; nothing to sync.");
    setOutput("changed", "false");
    return;
  }

  const results = JSON.parse(readFileSync(RESULTS_PATH, "utf8"));
  const matches = { ...(results.matches || {}) };
  const overrides = results.overrides || {};
  const locked = new Set(overrides.lockedMatches || []);

  const finals = await collectFinals();
  const next = { ...matches };

  // Group matches: map by unordered team pair.
  const koFinals = [];
  for (const f of finals) {
    if (!f.isGroup) {
      koFinals.push(f);
      continue;
    }
    const m = groupByPair.get([...f.pair].sort().join("|"));
    if (!m) {
      console.error(`WARN: no group fixture for ${f.pair.join(" v ")}`);
      continue;
    }
    if (!locked.has(m.code)) next[m.code] = entryFor(m.home, m.away, f);
  }

  // Knockout matches: resolve actual slot teams from current results and match
  // by team set, iterating so earlier rounds unlock later ones.
  const placed = new Set();
  for (let pass = 0; pass < koMatches.length + 1; pass++) {
    const actual = computeActual(tournament, { matches: next, overrides });
    let progressed = false;
    for (let i = 0; i < koFinals.length; i++) {
      if (placed.has(i)) continue;
      const f = koFinals[i];
      const key = [...f.pair].sort().join("|");
      const m = koMatches.find((mm) => {
        const slot = actual.slotTeams[mm.code];
        return (
          slot &&
          slot.home &&
          slot.away &&
          [slot.home, slot.away].sort().join("|") === key
        );
      });
      if (m) {
        if (!locked.has(m.code)) {
          next[m.code] = entryFor(
            actual.slotTeams[m.code].home,
            actual.slotTeams[m.code].away,
            f
          );
        }
        placed.add(i);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  const unplaced = koFinals.length - placed.size;
  if (unplaced > 0) {
    console.error(
      `WARN: ${unplaced} knockout result(s) could not be matched yet (slots not resolved)`
    );
  }

  // Diff against what we had.
  const changes = [];
  for (const code of Object.keys(next)) {
    if (JSON.stringify(next[code]) !== JSON.stringify(matches[code])) {
      const s = next[code].score;
      const p = next[code].pens ? ` (${next[code].pens.join("-")} pens)` : "";
      changes.push(`${code} ${s[0]}-${s[1]}${p}`);
    }
  }

  if (changes.length === 0) {
    console.log("No new results.");
    setOutput("changed", "false");
    return;
  }

  results.matches = Object.fromEntries(
    Object.entries(next).sort(
      (a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))
    )
  );
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 1) + "\n");
  changes.sort((a, b) => Number(a.split(" ")[0].slice(1)) - Number(b.split(" ")[0].slice(1)));
  console.log("Updated:", changes.join(", "));
  setOutput("changed", "true");
  setOutput("summary", changes.join(", ").slice(0, 200));
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
