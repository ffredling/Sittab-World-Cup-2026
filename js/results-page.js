import { loadData, renderNav, chip, statusLine } from "./app.js";
import { computeActual } from "./engine.js";
import { renderKoBracket } from "./bracket-render.js";

const { tournament, results, teams } = await loadData();
renderNav("results");

const actual = computeActual(tournament, results);

document.getElementById("status").textContent =
  `${statusLine(tournament, results)} · scores live on the Matches tab · group tables, ` +
  `third-place ranking and the bracket fill in automatically`;

// ---- warnings ----
const warnings = [];
for (const [g, grp] of Object.entries(actual.groups)) {
  if (grp.tieWarning) {
    warnings.push(
      `Group ${g} has a tie that points, goal difference, goals scored and ` +
        `head-to-head cannot break — order is alphabetical until an ` +
        `<code>overrides.groupOrder</code> entry is added to data/results.json.`
    );
  }
}
if (actual.thirdsTieWarning) {
  warnings.push(
    `The 8th/9th third-place teams are tied on points, goal difference and ` +
      `goals scored — set <code>overrides.thirdsAdvancing</code> in ` +
      `data/results.json if FIFA's further tiebreakers decide differently.`
  );
}
document.getElementById("warnings").innerHTML = warnings
  .map((w) => `<div class="tie-warning">⚠ ${w}</div>`)
  .join("");

// ---- knockout tree (actual) ----
document.getElementById("ko").innerHTML = renderKoBracket(
  teams,
  (code) => {
    const r = results.matches[code];
    const st = actual.slotTeams[code] || { home: null, away: null };
    return {
      home: st.home,
      away: st.away,
      score: r && r.score ? r.score : null,
      pens: r && r.pens ? r.pens : null,
      winner: actual.winners[code] || null,
    };
  },
  `<div class="champ-box"><div class="lbl">World Champion</div>${
    actual.champion
      ? chip(teams, actual.champion)
      : '<div class="champ-tbd">TBD</div>'
  }</div>`
);

// ---- thirds ranking ----
document.getElementById("thirds-note").textContent = actual.advancingThirds
  ? "Top 8 advance to the Round of 32."
  : actual.thirdRows.length
    ? "Provisional — only finished groups are ranked; top 8 advance once all groups are done."
    : "Appears once the first group finishes.";

document.getElementById("thirds-wrap").innerHTML = actual.thirdRows.length
  ? `<div class="card table-card" style="max-width:560px"><table class="thirds-table">
     <thead><tr><th></th><th>Team</th><th>Grp</th>
     <th class="num">Pts</th><th class="num">GD</th><th class="num">GF</th></tr></thead>
   <tbody>${actual.thirdRows
     .map(
       (r, i) => `<tr class="${i === 7 && actual.advancingThirds ? "cutoff" : ""}">
        <td class="num" style="color:var(--gray-40)">${i + 1}</td>
        <td>${chip(teams, r.code)}</td><td>${r.group}</td>
        <td class="num">${r.Pts}</td><td class="num">${r.GD > 0 ? "+" : ""}${r.GD}</td>
        <td class="num">${r.GF}</td>
      </tr>`
     )
     .join("")}</tbody></table></div>`
  : `<div class="empty-card">No groups finished yet.</div>`;

// ---- groups ----
const matchesByGroup = {};
for (const m of tournament.matches) {
  if (m.stage === "group") {
    (matchesByGroup[m.group] = matchesByGroup[m.group] || []).push(m);
  }
}

document.getElementById("groups").innerHTML = Object.keys(actual.groups)
  .sort()
  .map((g) => {
    const grp = actual.groups[g];
    const rows = grp.table
      .map((r, i) => {
        const advanced = grp.finished && i < 2;
        const third =
          grp.finished &&
          i === 2 &&
          actual.advancingThirds &&
          actual.advancingThirds.includes(g);
        return `<tr class="${i === 2 ? "r3" : ""}">
        <td style="width:20px;color:var(--muted)">${i + 1}</td>
        <td>${chip(teams, r.code, advanced || third ? "s-correct" : "")}</td>
        <td class="num">${r.P}</td><td class="num">${r.W}</td>
        <td class="num">${r.D}</td><td class="num">${r.L}</td>
        <td class="num">${r.GF}-${r.GA}</td>
        <td class="num"><strong>${r.Pts}</strong></td>
      </tr>`;
      })
      .join("");
    const matchLines = matchesByGroup[g]
      .map((m) => {
        const r = results.matches[m.code];
        const sc = r && r.score ? `${r.score[0]}–${r.score[1]}` : "vs";
        return `<div class="${r ? "" : "unplayed"}">${chip(teams, m.home)}
          <span class="score">${sc}</span> ${chip(teams, m.away)}</div>`;
      })
      .join("");
    return `<div class="card group-card">
      <h3><span>Group ${g}</span>${grp.finished ? '<span class="badge ok">final</span>' : ""}</h3>
      <table>
        <thead><tr><th></th><th>Team</th><th class="num">P</th><th class="num">W</th>
        <th class="num">D</th><th class="num">L</th><th class="num">+/-</th><th class="num">Pts</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="group-matches">${matchLines}</div>
    </div>`;
  })
  .join("");
