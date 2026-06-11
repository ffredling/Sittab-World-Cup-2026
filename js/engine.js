// Pure tournament logic: group standings, third-place allocation, knockout
// propagation and scoring. Used by all pages and by scripts/test_engine.mjs.

export const STAGES = ["r32", "r16", "qf", "sf", "third", "final"];

export const STAGE_LABELS = {
  group: "Group stage",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarterfinals",
  sf: "Semifinals",
  third: "Third place",
  final: "Final",
};

export function teamMap(tournament) {
  const map = {};
  for (const t of tournament.teams) map[t.code] = t;
  return map;
}

export function matchMap(tournament) {
  const map = {};
  for (const m of tournament.matches) map[m.code] = m;
  return map;
}

function emptyRow(code) {
  return { code, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
}

// Sort rows by points, goal difference, goals for; break full ties with a
// head-to-head sub-table among the tied teams, then by the override order if
// given, else alphabetically with a warning flag.
function sortRows(rows, groupMatches, results, override) {
  const tied = { warning: false };
  const cmpStats = (a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF;

  const resolve = (subset, depth) => {
    const sorted = [...subset].sort(cmpStats);
    const out = [];
    let i = 0;
    while (i < sorted.length) {
      let j = i + 1;
      while (
        j < sorted.length &&
        cmpStats(sorted[i], sorted[j]) === 0
      ) {
        j++;
      }
      const block = sorted.slice(i, j);
      if (block.length === 1) {
        out.push(block[0]);
      } else if (depth === 0 && block.length < subset.length) {
        // head-to-head among the tied teams only
        const codes = new Set(block.map((r) => r.code));
        const sub = {};
        for (const c of codes) sub[c] = emptyRow(c);
        for (const m of groupMatches) {
          const r = results.matches[m.code];
          if (!r || !codes.has(m.home) || !codes.has(m.away)) continue;
          applyResult(sub[m.home], sub[m.away], r.score);
        }
        const subOrder = resolve(
          block.map((r) => sub[r.code]),
          1
        );
        out.push(...subOrder.map((s) => block.find((r) => r.code === s.code)));
      } else {
        if (override) {
          block.sort(
            (a, b) => override.indexOf(a.code) - override.indexOf(b.code)
          );
        } else {
          block.sort((a, b) => a.code.localeCompare(b.code));
          tied.warning = true;
        }
        out.push(...block);
      }
      i = j;
    }
    return out;
  };

  return { order: resolve(rows, 0), tieWarning: tied.warning };
}

function applyResult(homeRow, awayRow, score) {
  const [hs, as] = score;
  homeRow.P++;
  awayRow.P++;
  homeRow.GF += hs;
  homeRow.GA += as;
  awayRow.GF += as;
  awayRow.GA += hs;
  homeRow.GD = homeRow.GF - homeRow.GA;
  awayRow.GD = awayRow.GF - awayRow.GA;
  if (hs > as) {
    homeRow.W++;
    awayRow.L++;
    homeRow.Pts += 3;
  } else if (hs < as) {
    awayRow.W++;
    homeRow.L++;
    awayRow.Pts += 3;
  } else {
    homeRow.D++;
    awayRow.D++;
    homeRow.Pts++;
    awayRow.Pts++;
  }
}

// Winner of an entered match result; null for group draws or undecidable input.
export function matchWinner(match, result) {
  if (!result || !result.score || !match.home || !match.away) return null;
  const [hs, as] = result.score;
  if (hs > as) return match.home;
  if (as > hs) return match.away;
  if (result.pens) {
    const [hp, ap] = result.pens;
    if (hp > ap) return match.home;
    if (ap > hp) return match.away;
  }
  return null;
}

// Map the set of 8 advancing third-place groups to {hostGroup: thirdGroup}
// using the official FIFA allocation table.
export function allocateThirds(tournament, advancingGroups) {
  const key = [...advancingGroups].sort().join("");
  const alloc = tournament.thirdPlace.table[key];
  if (!alloc) return null;
  const out = {};
  tournament.thirdPlace.winnerOrder.forEach((hostGroup, i) => {
    out[hostGroup] = alloc[i];
  });
  return out;
}

// Compute everything that follows from the entered results.
export function computeActual(tournament, results) {
  const matches = tournament.matches;
  const overrides = results.overrides || {};
  const groupOrderOverrides = overrides.groupOrder || {};

  const groups = {};
  for (const t of tournament.teams) {
    groups[t.group] = groups[t.group] || { rows: {}, matches: [] };
    groups[t.group].rows[t.code] = emptyRow(t.code);
  }
  for (const m of matches) {
    if (m.stage === "group") groups[m.group].matches.push(m);
  }

  for (const g of Object.keys(groups)) {
    const grp = groups[g];
    let played = 0;
    for (const m of grp.matches) {
      const r = results.matches[m.code];
      if (!r || !r.score) continue;
      played++;
      applyResult(grp.rows[m.home], grp.rows[m.away], r.score);
    }
    const { order, tieWarning } = sortRows(
      Object.values(grp.rows),
      grp.matches,
      results,
      groupOrderOverrides[g]
    );
    grp.order = order.map((r) => r.code);
    grp.table = order;
    grp.finished = played === grp.matches.length;
    grp.tieWarning = grp.finished && tieWarning && !groupOrderOverrides[g];
  }

  const allFinished = Object.values(groups).every((g) => g.finished);

  // Ranking of third-placed teams (only from finished groups).
  const thirdRows = [];
  for (const g of Object.keys(groups).sort()) {
    if (groups[g].finished) {
      const row = groups[g].table[2];
      thirdRows.push({ ...row, group: g });
    }
  }
  thirdRows.sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF);
  let thirdsTieWarning = false;
  let advancingThirds = null; // array of group letters
  if (allFinished) {
    if (overrides.thirdsAdvancing) {
      advancingThirds = [...overrides.thirdsAdvancing].sort();
    } else {
      const cut = thirdRows[7];
      const bubble = thirdRows[8];
      if (
        bubble &&
        cut.Pts === bubble.Pts &&
        cut.GD === bubble.GD &&
        cut.GF === bubble.GF
      ) {
        thirdsTieWarning = true;
      }
      advancingThirds = thirdRows
        .slice(0, 8)
        .map((r) => r.group)
        .sort();
    }
  }

  // Resolve actual knockout slots and winners, in match order.
  const matchByCode = matchMap(tournament);
  const slotTeams = {};
  const winners = {};
  const losers = {};
  const thirdAlloc = advancingThirds
    ? allocateThirds(tournament, advancingThirds)
    : null;

  const resolveSlot = (slot) => {
    if (!slot) return null;
    const mRef = slot.match(/^([WL]) (M\d+)$/);
    if (mRef) {
      const [, kind, code] = mRef;
      return kind === "W" ? winners[code] || null : losers[code] || null;
    }
    const rank = slot.match(/^([12])([A-L])$/);
    if (rank) {
      const grp = groups[rank[2]];
      return grp.finished ? grp.order[Number(rank[1]) - 1] : null;
    }
    if (slot.startsWith("3-")) return null; // handled via allocation below
    return null;
  };

  for (const m of matches) {
    if (m.stage === "group") {
      const w = matchWinner(m, results.matches[m.code]);
      if (w) winners[m.code] = w;
      continue;
    }
    let home = resolveSlot(m.slotHome);
    let away = resolveSlot(m.slotAway);
    if (m.slotAway.startsWith("3-") && thirdAlloc) {
      const hostGroup = m.slotHome.slice(1); // "1E" -> "E"
      const thirdGroup = thirdAlloc[hostGroup];
      if (thirdGroup) away = groups[thirdGroup].order[2];
    }
    slotTeams[m.code] = { home, away };
    const r = results.matches[m.code];
    if (r && home && away) {
      const w = matchWinner({ ...m, home, away }, r);
      if (w) {
        winners[m.code] = w;
        losers[m.code] = w === home ? away : home;
      }
    }
  }

  return {
    groups,
    allGroupsFinished: allFinished,
    thirdRows,
    advancingThirds,
    thirdsTieWarning,
    thirdAlloc,
    slotTeams,
    winners,
    losers,
    champion: winners.M104 || null,
  };
}

// Resolve a participant's predicted teams for every knockout match from their
// group picks, advancing thirds and picked winners.
export function resolveBracketSlots(tournament, bracket) {
  const slotTeams = {};
  const thirdAlloc = allocateThirds(tournament, bracket.thirdsAdvancing);

  const resolveSlot = (slot, matchSlotHome) => {
    const mRef = slot.match(/^([WL]) (M\d+)$/);
    if (mRef) {
      const [, kind, code] = mRef;
      const feeder = slotTeams[code];
      const picked = bracket.koPicks[code] || null;
      if (kind === "W") return picked;
      if (!feeder || !picked) return null;
      if (feeder.home === picked) return feeder.away;
      if (feeder.away === picked) return feeder.home;
      return null;
    }
    const rank = slot.match(/^([12])([A-L])$/);
    if (rank) {
      const picks = bracket.groupFinish[rank[2]];
      return picks ? picks[Number(rank[1]) - 1] : null;
    }
    if (slot.startsWith("3-")) {
      if (!thirdAlloc) return null;
      const hostGroup = matchSlotHome.slice(1);
      const thirdGroup = thirdAlloc[hostGroup];
      const picks = bracket.groupFinish[thirdGroup];
      return picks ? picks[2] : null;
    }
    return null;
  };

  for (const m of tournament.matches) {
    if (m.stage === "group") continue;
    slotTeams[m.code] = {
      home: resolveSlot(m.slotHome, m.slotHome),
      away: resolveSlot(m.slotAway, m.slotHome),
    };
  }
  return slotTeams;
}

// For each knockout match, which teams could still appear in it given the
// entered results (upper bound; used for "still possible" points).
export function possibleKoTeams(tournament, actual) {
  const possible = {};
  const groupTopPossible = {}; // group -> Set of codes that can still finish top 2
  const groupThirdPossible = {}; // group -> Set of codes that can still finish 3rd

  for (const [g, grp] of Object.entries(actual.groups)) {
    if (grp.finished) {
      groupTopPossible[g] = new Set(grp.order.slice(0, 2));
      groupThirdPossible[g] = new Set([grp.order[2]]);
    } else {
      // Upper bound: a team can still finish top 2 unless its maximum
      // achievable points are below the current runner-up's points.
      const playedByTeam = {};
      for (const row of grp.table) playedByTeam[row.code] = row;
      const second = grp.table[1];
      const top = new Set();
      for (const row of grp.table) {
        const maxPts = row.Pts + 3 * (3 - row.P);
        if (maxPts >= second.Pts) top.add(row.code);
      }
      groupTopPossible[g] = top;
      groupThirdPossible[g] = new Set(grp.order.map((r) => r));
    }
  }

  const resolveSlot = (slot, matchSlotHome, code) => {
    const mRef = slot.match(/^([WL]) (M\d+)$/);
    if (mRef) {
      const [, kind, ref] = mRef;
      if (kind === "W") {
        if (actual.winners[ref]) return new Set([actual.winners[ref]]);
        return possible[ref] || new Set();
      }
      if (actual.losers[ref]) return new Set([actual.losers[ref]]);
      return possible[ref] || new Set();
    }
    const rank = slot.match(/^([12])([A-L])$/);
    if (rank) {
      const grp = actual.groups[rank[2]];
      if (grp.finished) return new Set([grp.order[Number(rank[1]) - 1]]);
      return groupTopPossible[rank[2]];
    }
    if (slot.startsWith("3-")) {
      if (actual.thirdAlloc) {
        const hostGroup = matchSlotHome.slice(1);
        const g = actual.thirdAlloc[hostGroup];
        return new Set([actual.groups[g].order[2]]);
      }
      // Any team that could still finish third in any of the listed groups.
      const set = new Set();
      for (const g of slot.slice(2)) {
        for (const c of groupThirdPossible[g] || []) set.add(c);
      }
      return set;
    }
    return new Set();
  };

  for (const m of tournament.matches) {
    if (m.stage === "group") continue;
    const home = resolveSlot(m.slotHome, m.slotHome);
    const away = resolveSlot(m.slotAway, m.slotHome);
    possible[m.code] = new Set([...home, ...away]);
  }
  return possible;
}

// Score one bracket against the actual results.
// Returns {breakdown, total, potential, pickStatus} where pickStatus maps
// "G:A:CZE" / "T:A" / "M73" pick keys to "correct" | "wrong" | "pending" | "dead".
export function scoreBracket(tournament, bracket, actual, possible) {
  const S = tournament.scoring;
  const breakdown = {
    groupAdvance: 0,
    groupThird: 0,
    r32: 0,
    r16: 0,
    qf: 0,
    sf: 0,
    third: 0,
    final: 0,
  };
  let potential = 0;
  const pickStatus = {};

  // Group advancement: 2 pts per team correctly in the top 2 (order-agnostic).
  for (const [g, picks] of Object.entries(bracket.groupFinish)) {
    const grp = actual.groups[g];
    const actualTop2 = grp.finished ? grp.order.slice(0, 2) : null;
    for (const rank of [0, 1]) {
      const team = picks[rank];
      if (!team) continue;
      const key = `G:${g}:${rank + 1}`;
      if (actualTop2) {
        if (actualTop2.includes(team)) {
          breakdown.groupAdvance += S.group_advance;
          pickStatus[key] = "correct";
        } else {
          pickStatus[key] = "wrong";
        }
      } else {
        const alive = possibleTop2(actual, g, team);
        pickStatus[key] = alive ? "pending" : "dead";
        if (alive) potential += S.group_advance;
      }
    }
    // Third-place pick row (scored under "thirds advancing" below); status here
    // reflects whether the team really finished third.
    const team = picks[2];
    if (team) {
      const key = `G:${g}:3`;
      if (grp.finished) {
        pickStatus[key] = grp.order[2] === team ? "correct" : "wrong";
      } else {
        pickStatus[key] = "pending";
      }
    }
  }

  // Advancing thirds: 3 pts when the picked team advances as a third.
  for (const g of bracket.thirdsAdvancing) {
    const team = bracket.groupFinish[g] ? bracket.groupFinish[g][2] : null;
    const key = `T:${g}`;
    if (!team) {
      pickStatus[key] = "pending";
      continue;
    }
    if (actual.advancingThirds) {
      const advancingTeams = actual.advancingThirds.map(
        (ag) => actual.groups[ag].order[2]
      );
      if (advancingTeams.includes(team)) {
        breakdown.groupThird += S.group_third;
        pickStatus[key] = "correct";
      } else {
        pickStatus[key] = "wrong";
      }
    } else {
      const grp = actual.groups[g];
      let alive;
      if (grp.finished) {
        alive = grp.order[2] === team; // must await thirds ranking
      } else {
        alive = true;
      }
      pickStatus[key] = alive ? "pending" : "dead";
      if (alive) potential += S.group_third;
    }
  }

  // Knockout picks.
  const stageKey = { r32: "r32", r16: "r16", qf: "qf", sf: "sf", third: "third", final: "final" };
  const stagePoints = { r32: S.r32, r16: S.r16, qf: S.qf, sf: S.sf, third: S.third, final: S.final };
  for (const m of tournament.matches) {
    if (m.stage === "group") continue;
    const pick = bracket.koPicks[m.code];
    if (!pick) continue;
    const pts = stagePoints[m.stage];
    const winner = actual.winners[m.code];
    if (winner) {
      if (winner === pick) {
        breakdown[stageKey[m.stage]] += pts;
        pickStatus[m.code] = "correct";
      } else {
        pickStatus[m.code] = "wrong";
      }
    } else {
      const alive = possible[m.code] && possible[m.code].has(pick);
      pickStatus[m.code] = alive ? "pending" : "dead";
      if (alive) potential += pts;
    }
  }

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { breakdown, total, potential: total + potential, pickStatus };
}

function possibleTop2(actual, g, team) {
  const grp = actual.groups[g];
  if (grp.finished) return grp.order.slice(0, 2).includes(team);
  const row = grp.table.find((r) => r.code === team);
  const second = grp.table[1];
  return row.Pts + 3 * (3 - row.P) >= second.Pts;
}

export function maxPoints(tournament) {
  const S = tournament.scoring;
  return (
    12 * 2 * S.group_advance +
    8 * S.group_third +
    16 * S.r32 +
    8 * S.r16 +
    4 * S.qf +
    2 * S.sf +
    S.third +
    S.final
  );
}

// Convenience wrapper used by all pages.
export function scoreAll(tournament, brackets, results) {
  const actual = computeActual(tournament, results);
  const possible = possibleKoTeams(tournament, actual);
  const scores = {};
  for (const b of brackets) {
    scores[b.id] = scoreBracket(tournament, b, actual, possible);
  }
  return { actual, possible, scores };
}
