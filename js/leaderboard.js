import { loadData, renderNav, chip, esc, statusLine } from "./app.js";
import { scoreAll } from "./engine.js";

const { tournament, brackets, results, teams } = await loadData();
renderNav("leaderboard");

const { scores } = scoreAll(tournament, brackets, results);

const order = [...brackets].sort(
  (a, b) =>
    scores[b.id].total - scores[a.id].total ||
    scores[b.id].potential - scores[a.id].potential ||
    a.name.localeCompare(b.name)
);

document.getElementById("status").textContent =
  `${statusLine(tournament, results)} · results update automatically as matches finish (usually within a few hours)`;

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
    .map(
      ([k]) =>
        `<td class="bd">${s.breakdown[k] || '<span class="dot0">·</span>'}</td>`
    )
    .join("");
  return `<tr>
    <td class="pos">${rank}</td>
    <td class="name"><a href="bracket.html?id=${b.id}">${esc(b.name)}</a></td>
    <td class="champ">${chip(teams, b.champion)}</td>
    ${breakdownCells}
    <td class="num total">${s.total}</td>
    <td class="num pot">${s.potential}</td>
  </tr>`;
});

document.getElementById("lb").innerHTML = `
  <thead><tr>
    <th class="pos"></th><th>Name</th><th class="champ">Champion</th>
    ${cols.map(([, l]) => `<th class="bd">${l}</th>`).join("")}
    <th class="num">Total</th><th class="num">Possible</th>
  </tr></thead>
  <tbody>${rows.join("")}</tbody>`;
