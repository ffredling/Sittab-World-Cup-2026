import { loadData, renderNav } from "./app.js";
import { STAGE_LABELS } from "./engine.js";

const { tournament } = await loadData();
renderNav("rules");

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
