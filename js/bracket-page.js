import { loadData, renderNav, chip, esc } from "./app.js";
import { scoreAll, resolveBracketSlots, maxPoints } from "./engine.js";
import { renderKoBracket } from "./bracket-render.js";

const { tournament, brackets, results, teams } = await loadData();

const id = new URLSearchParams(location.search).get("id") || brackets[0].id;
const bracket = brackets.find((b) => b.id === id) || brackets[0];
renderNav(null);

const switcher = document.getElementById("player-switch");
switcher.innerHTML = brackets
  .map(
    (b) =>
      `<option value="${b.id}"${b.id === bracket.id ? " selected" : ""}>${esc(b.name)}</option>`
  )
  .join("");
switcher.addEventListener("change", () => {
  location.href = `bracket.html?id=${switcher.value}`;
});

const { scores } = scoreAll(tournament, brackets, results);
const score = scores[bracket.id];
const slots = resolveBracketSlots(tournament, bracket);

const order = [...brackets].sort(
  (a, b) =>
    scores[b.id].total - scores[a.id].total ||
    scores[b.id].potential - scores[a.id].potential ||
    a.name.localeCompare(b.name)
);
const rank = order.findIndex((b) => b.id === bracket.id) + 1;

document.title = `${bracket.name} · Sittab World Cup 2026`;
document.getElementById("ppoints").innerHTML =
  `${score.total} <small>points</small>`;
document.getElementById("prank").innerHTML = `#${rank} <small>of ${brackets.length}</small>`;
document.getElementById("ppotential").innerHTML =
  `${score.potential} <small>still possible of ${maxPoints(tournament)}</small>`;
document.getElementById("psub").innerHTML =
  `Champion pick: ${chip(teams, bracket.champion)} · ` +
  (bracket.complete
    ? "complete bracket"
    : '<span class="badge warn">incomplete bracket — missing picks score 0</span>') +
  ` · <a href="${bracket.sourceUrl}" style="text-decoration:underline">original on defirate.com</a>`;

// ---- knockout tree (predicted matchups + verdicts) ----
const stagePoints = {
  r32: tournament.scoring.r32,
  r16: tournament.scoring.r16,
  qf: tournament.scoring.qf,
  sf: tournament.scoring.sf,
  third: tournament.scoring.third,
  final: tournament.scoring.final,
};
const matchByCode = {};
for (const m of tournament.matches) matchByCode[m.code] = m;

document.getElementById("ko").innerHTML = renderKoBracket(
  teams,
  (code) => {
    const m = matchByCode[code];
    const st = score.pickStatus[code] || null;
    const pts = stagePoints[m.stage];
    const verdict =
      st === "correct" ? `✓ +${pts}` : st === "wrong" ? "✗ 0" : null;
    return {
      home: slots[code].home,
      away: slots[code].away,
      picked: bracket.koPicks[code] || null,
      status: st === "pending" ? null : st,
      verdict,
    };
  },
  `<div class="champ-box"><div class="lbl">Predicted Champion</div>${chip(teams, bracket.champion)}</div>`
);

// ---- advancing thirds ----
document.getElementById("thirds").innerHTML = bracket.thirdsAdvancing
  .map((g) => {
    const team = bracket.groupFinish[g] ? bracket.groupFinish[g][2] : null;
    const st = score.pickStatus[`T:${g}`];
    const cls = st && st !== "pending" ? `s-${st}` : "";
    const mark = st === "correct" ? " ✓" : st === "wrong" || st === "dead" ? " ✗" : "";
    return `<span class="third-pick ${cls}">3rd of ${g} · ${chip(teams, team)}${mark}</span>`;
  })
  .join("");

// ---- group predictions ----
document.getElementById("groups").innerHTML = Object.keys(bracket.groupFinish)
  .sort()
  .map((g) => {
    const picks = bracket.groupFinish[g];
    const thirdChosen = bracket.thirdsAdvancing.includes(g);
    const rows = [0, 1, 2]
      .map((i) => {
        const st = score.pickStatus[`G:${g}:${i + 1}`];
        const cls = st && st !== "pending" ? `s-${st}` : "";
        const mark =
          i < 2
            ? st === "correct"
              ? `✓ +${tournament.scoring.group_advance}`
              : st === "wrong"
                ? "✗"
                : st === "dead"
                  ? "✗"
                  : ""
            : st === "correct"
              ? "✓"
              : st === "wrong"
                ? "✗"
                : "";
        return `<tr class="r${i + 1} ${cls}">
          <td style="width:24px;color:var(--muted)">${i + 1}</td>
          <td>${chip(teams, picks[i])}</td>
          <td class="num">${mark}</td>
        </tr>`;
      })
      .join("");
    return `<div class="card group-card">
      <h3><span>Group ${g}</span>${thirdChosen ? '<span class="badge ok">3rd → R32</span>' : ""}</h3>
      <table>${rows}</table>
    </div>`;
  })
  .join("");
