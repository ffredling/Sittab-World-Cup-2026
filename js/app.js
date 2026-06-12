// Shared page helpers: data loading, navigation and small render utilities.
import { teamMap, STAGE_LABELS } from "./engine.js";

export async function loadData() {
  const bust = `?v=${Date.now()}`;
  const [tournament, brackets, results] = await Promise.all([
    fetch("data/tournament.json").then((r) => r.json()),
    fetch("data/brackets.json").then((r) => r.json()),
    fetch(`data/results.json${bust}`).then((r) => r.json()),
  ]);
  return { tournament, brackets, results, teams: teamMap(tournament) };
}

export function renderNav(active) {
  const nav = document.getElementById("nav");
  const links = [
    { href: "index.html", label: "Leaderboard", id: "leaderboard" },
    { href: "results.html", label: "Tournament", id: "results" },
    { href: "matches.html", label: "Matches", id: "matches" },
    { href: "rules.html", label: "Rules", id: "rules" },
  ];
  nav.innerHTML = `
    <div class="nav-inner">
      <a class="brand" href="index.html"><span class="ball">⚽</span> Sittab World Cup 2026</a>
      <div class="nav-links">
        ${links
          .map(
            (l) =>
              `<a class="${active === l.id ? "active" : ""}" href="${l.href}">${l.label}</a>`
          )
          .join("")}
      </div>
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
  return `${entered} of ${total} matches played`;
}

// All played matches as compact score cards, newest first (match codes
// follow the official schedule order). `actual` resolves knockout slots
// and winners.
export function renderPlayedMatches(tournament, results, teams, actual) {
  const played = tournament.matches
    .filter((m) => results.matches[m.code] && results.matches[m.code].score)
    .sort((a, b) => Number(b.code.slice(1)) - Number(a.code.slice(1)));
  if (!played.length) {
    return `<p class="note">No matches played yet.</p>`;
  }
  const stageLabel = (m) =>
    m.stage === "group" ? `Group ${m.group}` : STAGE_LABELS[m.stage];
  return `<div class="played-grid">${played
    .map((m) => {
      const r = results.matches[m.code];
      const home = m.stage === "group" ? m.home : (actual.slotTeams[m.code] || {}).home;
      const away = m.stage === "group" ? m.away : (actual.slotTeams[m.code] || {}).away;
      const winner = actual.winners[m.code];
      const pens = r.pens
        ? `<span class="pens">${r.pens[0]}–${r.pens[1]} pens</span>`
        : "";
      const row = (team, sc) =>
        `<div class="prow${winner && team === winner ? " win" : ""}">${chip(teams, team)}<span class="psc">${sc}</span></div>`;
      return `<div class="played-card">
        <div class="pstage">${stageLabel(m)} ${pens}</div>
        ${row(home, r.score[0])}
        ${row(away, r.score[1])}
      </div>`;
    })
    .join("")}</div>`;
}
