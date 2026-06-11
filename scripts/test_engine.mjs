// Tests for js/engine.js. Run with: npm test (or node scripts/test_engine.mjs)
import { readFileSync } from "node:fs";
import {
  allocateThirds,
  computeActual,
  maxPoints,
  resolveBracketSlots,
  scoreAll,
  scoreBracket,
  possibleKoTeams,
} from "../js/engine.js";

const tournament = JSON.parse(readFileSync("data/tournament.json", "utf8"));
const brackets = JSON.parse(readFileSync("data/brackets.json", "utf8"));

let failures = 0;
function check(name, cond, extra = "") {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${name} ${extra}`);
  }
}

const emptyResults = { matches: {}, overrides: {} };

// ---------------------------------------------------------------------------
// 1. The official third-place allocation table is internally consistent with
//    the Round of 32 slot constraints (e.g. "3-ABCDF").
const allowed = {};
for (const m of tournament.matches) {
  if (m.stage === "r32" && m.slotAway.startsWith("3-")) {
    allowed[m.slotHome.slice(1)] = new Set(m.slotAway.slice(2));
  }
}
check(
  "8 third-place R32 slots",
  Object.keys(allowed).length === 8,
  JSON.stringify(Object.keys(allowed))
);
let tableOk = 0;
for (const [key, alloc] of Object.entries(tournament.thirdPlace.table)) {
  const hosts = tournament.thirdPlace.winnerOrder;
  const assigned = [...alloc];
  const validPerm =
    [...assigned].sort().join("") === [...key].sort().join("");
  let constraintsOk = true;
  hosts.forEach((host, i) => {
    if (!allowed[host].has(assigned[i])) constraintsOk = false;
  });
  if (validPerm && constraintsOk) tableOk++;
  else check(`allocation table entry ${key}`, false, alloc);
}
check("all 495 allocation entries valid", tableOk === 495, `ok=${tableOk}`);

// ---------------------------------------------------------------------------
// 2. Every participant's picked KO winner appears in their own predicted
//    matchup for that match (validates extraction + slot resolution).
for (const b of brackets) {
  const slots = resolveBracketSlots(tournament, b);
  for (const m of tournament.matches) {
    if (m.stage === "group") continue;
    const pick = b.koPicks[m.code];
    if (!pick) continue;
    const { home, away } = slots[m.code];
    check(
      `${b.id} pick for ${m.code} in predicted matchup`,
      pick === home || pick === away,
      `pick=${pick} matchup=${home} vs ${away}`
    );
  }
  // Champion pick equals the final pick.
  check(`${b.id} champion equals M104 pick`, b.champion === b.koPicks.M104);
}

// ---------------------------------------------------------------------------
// 3. Simulate the tournament playing out exactly as Fredling predicted; his
//    complete bracket must then score the maximum.
function perfectResultsFor(bracket) {
  const results = { matches: {}, overrides: {} };
  const byGroup = {};
  for (const t of tournament.teams) {
    byGroup[t.group] = byGroup[t.group] || [];
    byGroup[t.group].push(t.code);
  }
  for (const [g, picks] of Object.entries(bracket.groupFinish)) {
    const fourth = byGroup[g].find((c) => !picks.includes(c));
    const order = [...picks, fourth];
    const chosenThird = bracket.thirdsAdvancing.includes(g);
    for (const m of tournament.matches) {
      if (m.stage !== "group" || m.group !== g) continue;
      const hi = order.indexOf(m.home);
      const ai = order.indexOf(m.away);
      const [better, margin] =
        hi < ai
          ? ["home", marginFor(Math.min(hi, ai), chosenThird)]
          : ["away", marginFor(Math.min(hi, ai), chosenThird)];
      results.matches[m.code] =
        better === "home" ? { score: [margin, 0] } : { score: [0, margin] };
    }
  }
  // Margins: 1st wins by 3, 2nd by 2, 3rd by 6 if this group's third should
  // rank among the top 8 thirds, else by 1.
  function marginFor(winnerRank, chosenThird) {
    return winnerRank === 0 ? 3 : winnerRank === 1 ? 2 : chosenThird ? 6 : 1;
  }
  // Knockouts: the picked winner wins every match; one match via penalties.
  const slots = resolveBracketSlots(tournament, bracket);
  for (const m of tournament.matches) {
    if (m.stage === "group") continue;
    const pick = bracket.koPicks[m.code];
    const { home } = slots[m.code];
    if (m.code === "M73") {
      results.matches[m.code] =
        pick === home
          ? { score: [1, 1], pens: [4, 2] }
          : { score: [1, 1], pens: [2, 4] };
    } else {
      results.matches[m.code] =
        pick === home ? { score: [1, 0] } : { score: [0, 1] };
    }
  }
  return results;
}

const fredling = brackets.find((b) => b.id === "fredling");
const perfect = perfectResultsFor(fredling);
{
  const actual = computeActual(tournament, perfect);
  check("all groups finished", actual.allGroupsFinished);
  check(
    "advancing thirds = Fredling's picks",
    JSON.stringify(actual.advancingThirds) ===
      JSON.stringify(fredling.thirdsAdvancing),
    JSON.stringify(actual.advancingThirds)
  );
  check("no thirds tie warning", !actual.thirdsTieWarning);
  check("champion is ESP", actual.champion === "ESP", actual.champion);
  for (const [g, grp] of Object.entries(actual.groups)) {
    check(`group ${g} no tie warning`, !grp.tieWarning);
    check(
      `group ${g} order matches picks`,
      JSON.stringify(grp.order.slice(0, 3)) ===
        JSON.stringify(fredling.groupFinish[g])
    );
  }
  const possible = possibleKoTeams(tournament, actual);
  const score = scoreBracket(tournament, fredling, actual, possible);
  check(
    `perfect bracket scores max (${maxPoints(tournament)})`,
    score.total === maxPoints(tournament),
    `got ${score.total}, breakdown ${JSON.stringify(score.breakdown)}`
  );
  check("perfect bracket potential equals total", score.potential === score.total);
  check(
    "all pick statuses correct",
    Object.values(score.pickStatus).every((s) => s === "correct")
  );
  check("max points is 360", maxPoints(tournament) === 360);

  // Winícius also picked Spain as champion: must receive the 32 final points.
  const w = brackets.find((b) => b.id === "winicius-jr");
  const ws = scoreBracket(tournament, w, actual, possible);
  check("winicius gets final points for ESP", ws.breakdown.final === 32);
  // Tim picked Czechia: no final points.
  const tim = brackets.find((b) => b.id === "tim");
  const ts = scoreBracket(tournament, tim, actual, possible);
  check("tim gets no final points", ts.breakdown.final === 0);
}

// ---------------------------------------------------------------------------
// 4. Empty results: nothing scored, everything still possible.
{
  const { actual, scores } = scoreAll(tournament, brackets, emptyResults);
  check("no groups finished", !actual.allGroupsFinished);
  for (const b of brackets) {
    const s = scores[b.id];
    check(`${b.id} zero points before results`, s.total === 0);
    // King John is missing an R16 pick (M90) and the third-place pick (M103);
    // Martin's M103 was filled in manually (see MANUAL_PICKS in extract_data.py).
    const expectedPotential = b.id === "king-johns-bracket" ? 360 - 8 - 16 : 360;
    check(
      `${b.id} potential is ${expectedPotential}`,
      s.potential === expectedPotential,
      `got ${s.potential}`
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Partial results: only group A decided (per Fredling's picks).
{
  const partial = { matches: {}, overrides: {} };
  for (const [code, r] of Object.entries(perfect.matches)) {
    const m = tournament.matches.find((m) => m.code === code);
    if (m.stage === "group" && m.group === "A") partial.matches[code] = r;
  }
  const actual = computeActual(tournament, partial);
  check("group A finished", actual.groups.A.finished);
  check("group B not finished", !actual.groups.B.finished);
  check("thirds not final", actual.advancingThirds === null);
  const possible = possibleKoTeams(tournament, actual);
  const s = scoreBracket(tournament, fredling, actual, possible);
  check("partial: 4 points from group A", s.total === 4, `got ${s.total}`);
  check(
    "partial: potential still 360",
    s.potential === 360,
    `got ${s.potential}`
  );
  // A 4th-placed team from a finished group cannot appear in any KO match.
  const fourthA = actual.groups.A.order[3];
  for (const m of tournament.matches) {
    if (m.stage === "group") continue;
    check(
      `eliminated ${fourthA} not possible in ${m.code}`,
      !possible[m.code].has(fourthA)
    );
  }
}

// ---------------------------------------------------------------------------
// 6. Head-to-head tiebreak: find scores where two teams tie on Pts/GD/GF and
//    head-to-head must decide; verify order and absence of a tie warning.
{
  const groupA = tournament.matches.filter(
    (m) => m.stage === "group" && m.group === "A"
  );
  const options = [];
  for (let h = 0; h <= 2; h++) for (let a = 0; a <= 2; a++) options.push([h, a]);
  let found = null;
  const idx = [0, 0, 0, 0, 0, 0];
  outer: while (true) {
    const results = { matches: {}, overrides: {} };
    groupA.forEach((m, i) => {
      results.matches[m.code] = { score: options[idx[i]] };
    });
    const actual = computeActual(tournament, results);
    const grp = actual.groups.A;
    const rows = grp.table;
    for (let i = 0; i < 3; i++) {
      const a = rows[i];
      const b = rows[i + 1];
      if (a.Pts === b.Pts && a.GD === b.GD && a.GF === b.GF) {
        const h2h = groupA.find(
          (m) =>
            (m.home === a.code && m.away === b.code) ||
            (m.home === b.code && m.away === a.code)
        );
        const r = results.matches[h2h.code];
        if (r.score[0] !== r.score[1] && !grp.tieWarning) {
          const winner = r.score[0] > r.score[1] ? h2h.home : h2h.away;
          // Only a clean two-team tie (neighbours differ from both).
          const prev = rows[i - 1];
          const next = rows[i + 2];
          const same = (x, y) =>
            x && y && x.Pts === y.Pts && x.GD === y.GD && x.GF === y.GF;
          if (!same(prev, a) && !same(b, next)) {
            found = { winner, first: a.code, results };
            break outer;
          }
        }
      }
    }
    let k = 5;
    while (k >= 0) {
      idx[k]++;
      if (idx[k] < options.length) break;
      idx[k] = 0;
      k--;
    }
    if (k < 0) break;
  }
  check("found a head-to-head scenario", found !== null);
  if (found) {
    check(
      "head-to-head winner ranked first",
      found.winner === found.first,
      `h2h winner ${found.winner}, ranked first ${found.first}`
    );
  }
}

// ---------------------------------------------------------------------------
// 7. Full four-way tie: warning raised, then silenced by an explicit override.
{
  const groupA = tournament.matches.filter(
    (m) => m.stage === "group" && m.group === "A"
  );
  const results = { matches: {}, overrides: {} };
  for (const m of groupA) results.matches[m.code] = { score: [1, 1] };
  const actual = computeActual(tournament, results);
  check("four-way tie warning", actual.groups.A.tieWarning);

  const order = [...actual.groups.A.order].reverse();
  const withOverride = {
    matches: results.matches,
    overrides: { groupOrder: { A: order } },
  };
  const actual2 = computeActual(tournament, withOverride);
  check("override silences warning", !actual2.groups.A.tieWarning);
  check(
    "override order respected",
    JSON.stringify(actual2.groups.A.order) === JSON.stringify(order)
  );
}

// ---------------------------------------------------------------------------
if (failures === 0) {
  console.log("All engine tests passed.");
} else {
  console.error(`${failures} test(s) failed.`);
  process.exit(1);
}
