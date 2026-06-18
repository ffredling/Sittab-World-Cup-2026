import { loadData, renderNav, statusLine, renderPlayedMatches } from "./app.js";
import { computeActual } from "./engine.js";

const { tournament, results, teams } = await loadData();
renderNav("matches");

const actual = computeActual(tournament, results);

document.getElementById("status").textContent =
  `${statusLine(tournament, results)} · newest first · updates automatically as matches finish (usually within a few hours)`;

document.getElementById("played").innerHTML = renderPlayedMatches(
  tournament,
  results,
  teams,
  actual
);
