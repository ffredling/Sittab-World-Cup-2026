import { loadData, renderNav } from "./app.js";
import { maxPoints } from "./engine.js";

const { tournament } = await loadData();
renderNav("rules");

const S = tournament.scoring;
const rows = [
  ["Group standings", "GROUPS", 24 * S.group_advance],
  ["Best third-placed teams", "3RDS", 8 * S.group_third],
  ["Round of 32", "R32", 16 * S.r32],
  ["Round of 16", "R16", 8 * S.r16],
  ["Quarter-finals", "QF", 4 * S.qf],
  ["Semi-finals", "SF", 2 * S.sf],
  ["Bronze final", "BRONZE", S.third],
  ["Final", "FINAL", S.final],
];

document.getElementById("rules-table").innerHTML = `
  <thead><tr>
    <th>Stage</th><th>Column</th><th class="num">Points</th>
  </tr></thead>
  <tbody>
    ${rows
      .map(
        ([label, col, pts]) => `<tr>
      <td class="stage">${label}</td>
      <td class="col">${col}</td>
      <td class="num">${pts}</td>
    </tr>`
      )
      .join("")}
    <tr class="totalrow">
      <td class="total-label">Total possible</td>
      <td></td>
      <td class="num total-pts">${maxPoints(tournament)}</td>
    </tr>
  </tbody>`;
