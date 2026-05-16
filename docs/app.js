const SAMPLE_TEXT = ``;

const ROLE_CODES = ["P", "D", "C", "A"];

const playersBody = document.getElementById("players-body");
const playersText = document.getElementById("players-text");
const playersCount = document.getElementById("players-count");
const errorBox = document.getElementById("error-box");
const resultPlaceholder = document.getElementById("result-placeholder");
const resultContent = document.getElementById("result-content");
const useRandomCheckbox = document.getElementById("use-random");

playersText.value = SAMPLE_TEXT;

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("d-none");
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.add("d-none");
}

function buildRoleOptions(selectedRole) {
  return ROLE_CODES.map((code) => {
    const selected = selectedRole === code ? " selected" : "";
    return `<option value="${code}"${selected}>${code}</option>`;
  }).join("");
}

function applyRoleSelectColor(select) {
  select.classList.remove(...ROLE_CODES);
  if (select.value) {
    select.classList.add(select.value);
  }
}

function reindexRows() {
  const rows = playersBody.querySelectorAll(".player-edit-row");
  rows.forEach((row, index) => {
    row.querySelector(".player-index").textContent = String(index + 1);
  });
  playersCount.textContent = `${rows.length} inseriti`;
}

function addRow(name = "", rating = "", role = "C") {
  const row = document.createElement("div");
  row.className = "player-edit-row";
  row.innerHTML = `
    <div class="player-index"></div>
    <input type="text" name="player_name" value="${name}" class="player-name-input">
    <input type="number" name="player_rating" value="${rating}" min="0" max="99" class="player-rating-input">
    <select name="player_role" class="player-role-select ${role}">${buildRoleOptions(role)}</select>
  `;
  playersBody.appendChild(row);
  applyRoleSelectColor(row.querySelector('[name="player_role"]'));
  reindexRows();
}

function parseTextPlayers(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line, index) => {
      const parts = line.split(/\s+/);
      if (parts.length < 3) {
        throw new Error(`Riga ${index + 1}: formato non valido: ${line}`);
      }
      const role = parts.at(-1).toUpperCase();
      const ratingText = parts.at(-2);
      const name = parts.slice(0, -2).join(" ");
      if (!ROLE_CODES.includes(role)) {
        throw new Error(`Riga ${index + 1}: ruolo non valido: ${role}`);
      }
      const rating = Number.parseInt(ratingText, 10);
      if (Number.isNaN(rating)) {
        throw new Error(`Riga ${index + 1}: valore non valido: ${ratingText}`);
      }
      return { name, rating, role };
    });
}

function readPlayersFromForm() {
  const rows = Array.from(playersBody.querySelectorAll(".player-edit-row"));
  const players = [];
  rows.forEach((row, index) => {
    const name = row.querySelector('[name="player_name"]').value.trim();
    const ratingText = row.querySelector('[name="player_rating"]').value.trim();
    const role = row.querySelector('[name="player_role"]').value.trim();
    if (!name && !ratingText && !role) {
      return;
    }
    if (!name || !ratingText || !role) {
      throw new Error(`Riga ${index + 1}: compila tutti i campi oppure lascia la riga vuota.`);
    }
    const rating = Number.parseInt(ratingText, 10);
    if (Number.isNaN(rating)) {
      throw new Error(`Riga ${index + 1}: valore non valido.`);
    }
    players.push({ name, rating, role });
  });
  if (players.length < 2) {
    throw new Error("Servono almeno 2 giocatori.");
  }
  if (players.length % 2 !== 0) {
    throw new Error("Il numero di giocatori deve essere pari.");
  }
  return players;
}

function roleCounts(players) {
  const counts = { P: 0, D: 0, C: 0, A: 0 };
  players.forEach((player) => {
    counts[player.role] += 1;
  });
  return counts;
}

function teamScore(teamA, teamB) {
  const totalA = teamA.reduce((sum, player) => sum + player.rating, 0);
  const totalB = teamB.reduce((sum, player) => sum + player.rating, 0);
  const valueDiff = Math.abs(totalA - totalB);
  const countsA = roleCounts(teamA);
  const countsB = roleCounts(teamB);
  const roleDiff = ROLE_CODES.reduce((sum, role) => sum + Math.abs(countsA[role] - countsB[role]), 0);
  let gkPenalty = 0;
  if (countsA.P === 0) gkPenalty += 1000;
  if (countsB.P === 0) gkPenalty += 1000;
  const spreadPenalty =
    Math.abs(Math.min(...teamA.map((p) => p.rating)) - Math.min(...teamB.map((p) => p.rating))) +
    Math.abs(Math.max(...teamA.map((p) => p.rating)) - Math.max(...teamB.map((p) => p.rating)));
  return [gkPenalty, valueDiff, roleDiff, spreadPenalty];
}

function compareScores(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function combinations(n, k) {
  const result = [];
  const combo = [];
  function backtrack(start) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < n; i += 1) {
      combo.push(i);
      backtrack(i + 1);
      combo.pop();
    }
  }
  backtrack(0);
  return result;
}

function generateSplits(players) {
  const half = Math.floor(players.length / 2);
  const splits = [];
  combinations(players.length, half).forEach((indices) => {
    if (!indices.includes(0)) return;
    const left = new Set(indices);
    const teamA = players.filter((_, index) => left.has(index));
    const teamB = players.filter((_, index) => !left.has(index));
    splits.push({ score: teamScore(teamA, teamB), teamA, teamB });
  });
  splits.sort((a, b) => compareScores(a.score, b.score));
  return splits;
}

function findBestSplit(players, useRandom) {
  const splits = generateSplits(players);
  const bestScore = splits[0].score;
  if (!useRandom) {
    return splits[0];
  }
  const candidates = splits.filter((split) =>
    split.score[0] === bestScore[0] &&
    split.score[1] <= bestScore[1] + 1 &&
    split.score[2] <= bestScore[2] + 1
  );
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function formatRoleCounts(counts) {
  return `P=${counts.P} D=${counts.D} C=${counts.C} A=${counts.A}`;
}

function renderTeam(targetId, totalId, rolesId, team) {
  const list = document.getElementById(targetId);
  list.innerHTML = "";
  const ordered = [...team].sort((a, b) =>
    b.rating - a.rating || a.role.localeCompare(b.role) || a.name.localeCompare(b.name)
  );
  ordered.forEach((player) => {
    const row = document.createElement("div");
    row.className = "team-player-row";
    row.innerHTML = `
      <div class="team-player-name">${player.name}</div>
      <div class="role-chip ${player.role}">${player.role}</div>
      <div class="team-player-score">${player.rating}</div>
    `;
    list.appendChild(row);
  });
  const total = ordered.reduce((sum, player) => sum + player.rating, 0);
  const counts = roleCounts(ordered);
  document.getElementById(totalId).textContent = String(total);
  document.getElementById(rolesId).textContent = formatRoleCounts(counts);
}

function renderResult(result) {
  resultPlaceholder.classList.add("d-none");
  resultContent.classList.remove("d-none");

  const totalA = result.teamA.reduce((sum, player) => sum + player.rating, 0);
  const totalB = result.teamB.reduce((sum, player) => sum + player.rating, 0);
  document.getElementById("team-a-total").textContent = String(totalA);
  document.getElementById("team-b-total").textContent = String(totalB);
  document.getElementById("team-a-total-bar").textContent = String(totalA);
  document.getElementById("team-b-total-bar").textContent = String(totalB);
  document.getElementById("score-diff").textContent = String(result.score[1]);
  document.getElementById("score-caption").textContent = result.score[1] === 0 ? "Perfetto!" : "Molto vicine";

  renderTeam("team-a-list", "team-a-total-bar", "team-a-roles", result.teamA);
  renderTeam("team-b-list", "team-b-total-bar", "team-b-roles", result.teamB);
}

function exportTeams() {
  const teamA = Array.from(document.querySelectorAll("#team-a-list .team-player-name"))
    .map((node) => node.textContent.trim())
    .filter(Boolean);
  const teamB = Array.from(document.querySelectorAll("#team-b-list .team-player-name"))
    .map((node) => node.textContent.trim())
    .filter(Boolean);
  if (!teamA.length && !teamB.length) return "";
  return [
    "SQUADRA A",
    "",
    ...teamA,
    "",
    "",
    "SQUADRA B",
    "",
    ...teamB,
  ].join("\n");
}

document.getElementById("import-text").addEventListener("click", () => {
  try {
    hideError();
    const players = parseTextPlayers(playersText.value);
    playersBody.innerHTML = "";
    players.forEach((player) => addRow(player.name, String(player.rating), player.role));
  } catch (error) {
    showError(error.message);
  }
});

document.getElementById("add-row").addEventListener("click", () => addRow());

document.getElementById("clear-empty").addEventListener("click", () => {
  Array.from(playersBody.querySelectorAll(".player-edit-row")).forEach((row) => {
    const name = row.querySelector('[name="player_name"]').value.trim();
    const rating = row.querySelector('[name="player_rating"]').value.trim();
    if (!name && !rating) {
      row.remove();
    }
  });
  reindexRows();
});

playersBody.addEventListener("change", (event) => {
  if (event.target.name === "player_role") {
    applyRoleSelectColor(event.target);
  }
});

document.getElementById("calculate").addEventListener("click", () => {
  try {
    hideError();
    const players = readPlayersFromForm();
    const result = findBestSplit(players, useRandomCheckbox.checked);
    renderResult(result);
  } catch (error) {
    showError(error.message);
  }
});

document.getElementById("recalculate").addEventListener("click", () => {
  document.getElementById("calculate").click();
});

document.getElementById("export-text").addEventListener("click", async () => {
  const content = exportTeams();
  if (!content) {
    window.alert("Non ci sono squadre generate da esportare.");
    return;
  }
  try {
    await navigator.clipboard.writeText(content);
    window.alert("Squadre copiate negli appunti.");
  } catch {
    window.alert(content);
  }
});

addRow();
