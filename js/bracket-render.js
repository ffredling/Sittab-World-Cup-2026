// Renders the two-sided knockout tree. Used by the per-person bracket page
// (predicted teams + pick verdicts) and the tournament page (actual results).
import { chip, esc } from "./app.js";

const COLUMNS = [
  { title: "Round of 32", codes: ["M73", "M74", "M75", "M76", "M77", "M78", "M79", "M80"] },
  { title: "Round of 16", codes: ["M89", "M90", "M91", "M92"] },
  { title: "Quarterfinals", codes: ["M97", "M98"] },
  { title: "Semifinal", codes: ["M101"] },
  { title: "Final", codes: ["FINAL"] },
  { title: "Semifinal", codes: ["M102"] },
  { title: "Quarterfinals", codes: ["M99", "M100"] },
  { title: "Round of 16", codes: ["M93", "M94", "M95", "M96"] },
  { title: "Round of 32", codes: ["M81", "M82", "M83", "M84", "M85", "M86", "M87", "M88"] },
];

// opts per match code via decorate(code) -> {
//   home, away          team codes or null
//   score, pens         optional [h, a]
//   winner              actual winner code (bold row)
//   picked              picked winner code (bold + arrow on person pages)
//   status              "correct" | "wrong" | "dead" | "pending" | null
//   verdict             short string shown bottom-right (e.g. "✓ +8")
// }
export function renderKoBracket(teams, decorate, championHtml) {
  const matchCard = (code) => {
    const d = decorate(code);
    const cls = d.status ? ` m-${d.status}` : "";
    const row = (team, idx) => {
      const sc =
        d.score !== undefined && d.score !== null
          ? `${d.score[idx]}${d.pens ? ` (${d.pens[idx]})` : ""}`
          : "";
      const isWinner = d.winner && team && d.winner === team;
      const isPicked = d.picked && team && d.picked === team;
      return `<div class="trow${isWinner ? " winner" : ""}${isPicked ? " pickwin" : ""}">
        ${chip(teams, team)}<span class="sc">${sc}${isPicked && !sc ? "◄" : ""}</span>
      </div>`;
    };
    return `<div class="match${cls}${code === "M104" ? " final" : ""}">
      <span class="mcode">${code === "M103" ? "3rd place" : code}</span>
      ${row(d.home, 0)}
      ${row(d.away, 1)}
      ${d.verdict ? `<span class="verdict">${esc(d.verdict)}</span>` : ""}
    </div>`;
  };

  const cols = COLUMNS.map((col) => {
    const cards = col.codes
      .map((code) => {
        if (code === "FINAL") {
          return `<div class="final-stack">
            ${matchCard("M104")}
            ${championHtml || ""}
            ${matchCard("M103")}
          </div>`;
        }
        return matchCard(code);
      })
      .join("");
    return `<div class="round"><div class="round-title">${col.title}</div>${cards}</div>`;
  }).join("");

  return `<div class="bracket-scroll"><div class="bracket">${cols}</div></div>`;
}
