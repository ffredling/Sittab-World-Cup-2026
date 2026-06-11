// Shared page helpers: data loading, navigation and small render utilities.
import { teamMap } from "./engine.js";

export async function loadData() {
  const bust = `?v=${Date.now()}`;
  const [tournament, brackets, results] = await Promise.all([
    fetch("data/tournament.json").then((r) => r.json()),
    fetch("data/brackets.json").then((r) => r.json()),
    fetch(`data/results.json${bust}`).then((r) => r.json()),
  ]);
  return { tournament, brackets, results, teams: teamMap(tournament) };
}

export function renderNav(active, brackets) {
  const nav = document.getElementById("nav");
  const links = [
    { href: "index.html", label: "Leaderboard", id: "leaderboard" },
    { href: "results.html", label: "Tournament", id: "results" },
  ];
  const bracketLinks = brackets
    .map(
      (b) =>
        `<a class="nav-bracket${active === b.id ? " active" : ""}" href="bracket.html?id=${b.id}">${esc(b.name)}</a>`
    )
    .join("");
  nav.innerHTML = `
    <div class="nav-inner">
      <a class="brand" href="index.html">⚽ Sittab World Cup 2026</a>
      <div class="nav-links">
        ${links
          .map(
            (l) =>
              `<a class="${active === l.id ? "active" : ""}" href="${l.href}">${l.label}</a>`
          )
          .join("")}
      </div>
      <div class="nav-brackets">${bracketLinks}</div>
    </div>`;
}

export function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

export function flag(team, size = 20) {
  if (!team) return "";
  return `<img class="flag" src="${team.flag}" width="${size}" alt="" loading="lazy">`;
}

// Compact team chip: flag + code, full name as tooltip.
export function chip(teams, code, cls = "") {
  if (!code) return `<span class="chip tbd ${cls}">—</span>`;
  const t = teams[code];
  return `<span class="chip ${cls}" title="${esc(t.name)}">${flag(t)}<span>${code}</span></span>`;
}

// Team with full name (for tables).
export function teamFull(teams, code) {
  if (!code) return "—";
  const t = teams[code];
  return `<span class="chip" title="${code}">${flag(t)}<span>${esc(t.name)}</span></span>`;
}

export function resultsCount(tournament, results) {
  const entered = Object.keys(results.matches || {}).length;
  return { entered, total: tournament.matches.length };
}

export function statusLine(tournament, results) {
  const { entered, total } = resultsCount(tournament, results);
  return `${entered} of ${total} matches entered`;
}
