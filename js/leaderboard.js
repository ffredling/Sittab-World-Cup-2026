import { loadData, renderNav, chip, esc, statusLine } from "./app.js";
import { scoreAll, STAGE_LABELS } from "./engine.js";

const { tournament, brackets, results, teams } = await loadData();
renderNav("leaderboard", brackets);

const { scores } = scoreAll(tournament, brackets, results);

const order = [...brackets].sort(
  (a, b) =>
    scores[b.id].total - scores[a.id].total ||
    scores[b.id].potential - scores[a.id].potential ||
    a.name.localeCompare(b.name)
);

document.getElementById("status").textContent =
  `${statusLine(tournament, results)} · results sync automatically every ~30 minutes` +
  ` · scores appear on the Tournament page`;

const cols = [
  ["groupAdvance", "Groups"],
  ["groupThird", "3rds"],
  ["r32", "R32"],
  ["r16", "R16"],
  ["qf", "QF"],
  ["sf", "SF"],
  ["third", "Bronze"],
  ["final", "Final"],
];

let rank = 0;
let lastTotal = null;
const rows = order.map((b, i) => {
  const s = scores[b.id];
  if (s.total !== lastTotal) {
    rank = i + 1;
    lastTotal = s.total;
  }
  const breakdownCells = cols
    .map(([k]) => `<td class="num">${s.breakdown[k] || "·"}</td>`)
    .join("");
  return `<tr class="${rank === 1 ? "first" : ""}${b.complete ? "" : " incomplete"}">
    <td class="pos">${rank}</td>
    <td class="name"><a href="bracket.html?id=${b.id}">${esc(b.name)}</a>${b.complete ? "" : ' <span class="badge warn" title="Bracket not fully filled in on defirate">incomplete</span>'}</td>
    <td>${chip(teams, b.champion)}</td>
    ${breakdownCells}
    <td class="num total">${s.total}</td>
    <td class="num pot">${s.potential}</td>
  </tr>`;
});

document.getElementById("lb").innerHTML = `
  <thead><tr>
    <th></th><th>Name</th><th>Champion pick</th>
    ${cols.map(([, l]) => `<th class="num">${l}</th>`).join("")}
    <th class="num">Total</th><th class="num">Still possible</th>
  </tr></thead>
  <tbody>${rows.join("")}</tbody>`;

const S = tournament.scoring;
const scoringCards = [
  [S.group_advance, "Group top 2 (×24)"],
  [S.group_third, "Advancing 3rd (×8)"],
  [S.r32, STAGE_LABELS.r32 + " (×16)"],
  [S.r16, STAGE_LABELS.r16 + " (×8)"],
  [S.qf, STAGE_LABELS.qf + " (×4)"],
  [S.sf, STAGE_LABELS.sf + " (×2)"],
  [S.third, "3rd-place game"],
  [S.final, "Final"],
];
document.getElementById("scoring").innerHTML = scoringCards
  .map(
    ([pts, lbl]) =>
      `<div class="card"><div class="pts">${pts}</div><div class="lbl">${lbl}</div></div>`
  )
  .join("");
