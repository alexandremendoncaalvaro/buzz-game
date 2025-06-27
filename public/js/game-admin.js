class GameAdmin {
  constructor() {
    this.socket = io();
    this.adminToken = this.extractAdminToken();
    this.gameToken = this.extractGameToken();
    this.timerInterval = null;

    this.initializeElements();
    this.bindEvents();
    this.joinAsAdmin();
  }

  initializeElements() {
    this.elements = {
      gameTitle: document.getElementById("gameTitle"),
      gameCode: document.getElementById("gameCode"),
      gameLink: document.getElementById("gameLink"),
      copyButton: document.getElementById("copyLink"),
      secretInput: document.getElementById("secret"),
      maxPointsInput: document.getElementById("maxPoints"),
      startButton: document.getElementById("startRound"),
      cancelButton: document.getElementById("cancelRound"),
      endGameButton: document.getElementById("endGame"),
      timerDisplay: document.getElementById("timer"),
      scores: document.getElementById("scores"),
      history: document.getElementById("history"),
      buzzedPlayer: document.getElementById("buzzedPlayer"),
      correctButton: document.getElementById("correctAnswer"),
      incorrectButton: document.getElementById("incorrectAnswer"),
    };
  }

  bindEvents() {
    this.elements.copyButton.addEventListener("click", () =>
      this.copyGameLink()
    );
    this.elements.startButton.addEventListener("click", () =>
      this.startRound()
    );
    this.elements.cancelButton.addEventListener("click", () =>
      this.cancelRound()
    );
    this.elements.endGameButton.addEventListener("click", () => this.endGame());
    this.elements.correctButton.addEventListener("click", () =>
      this.markAnswer(true)
    );
    this.elements.incorrectButton.addEventListener("click", () =>
      this.markAnswer(false)
    );
    this.elements.secretInput.addEventListener("keypress", (e) =>
      this.handleSecretKeyPress(e)
    );

    this.bindSocketEvents();
  }

  bindSocketEvents() {
    this.socket.on("joined", (data) => this.handleJoined(data));
    this.socket.on("scoreUpdate", (data) => this.updateScores(data));
    this.socket.on("historyUpdate", (data) => this.updateHistory(data));
    this.socket.on("roundStarted", (data) => this.handleRoundStarted(data));
    this.socket.on("roundReset", () => this.handleRoundReset());
    this.socket.on("roundTimeout", () => this.handleRoundTimeout());
    this.socket.on("roundContinued", () => this.handleRoundContinued());
    this.socket.on("roundTimer", (data) => this.updateTimer(data));
    this.socket.on("buzzed", (data) => this.handleBuzzed(data));
    this.socket.on("error", (error) => this.showError(error.message));
  }

  extractAdminToken() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("token");
  }

  extractGameToken() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("game");
  }

  joinAsAdmin() {
    if (!this.adminToken) {
      this.redirectToCreate();
      return;
    }

    this.socket.emit("admin-join", { adminToken: this.adminToken });
  }

  handleJoined({ gameToken, roomTitle }) {
    this.updateGameInfo(gameToken, roomTitle);
    this.generateGameLink(gameToken);
  }

  updateGameInfo(gameToken, roomTitle) {
    this.elements.gameTitle.textContent = roomTitle;
    document.title = `Admin - ${roomTitle}`;
    this.elements.gameCode.textContent = this.formatGameCode(gameToken);
  }

  formatGameCode(gameToken) {
    return gameToken.replace("game-", "").toUpperCase();
  }

  generateGameLink(gameToken) {
    const gameUrl = `${window.location.origin}/index.html?game=${gameToken}`;
    this.elements.gameLink.value = gameUrl;
  }

  copyGameLink() {
    this.elements.gameLink.select();
    document.execCommand("copy");
    this.showTemporaryMessage(this.elements.copyButton, "Copiado!");
  }

  showTemporaryMessage(element, message) {
    const originalText = element.textContent;
    element.textContent = message;

    setTimeout(() => {
      element.textContent = originalText;
    }, 2000);
  }

  handleSecretKeyPress(event) {
    if (event.key === "Enter") {
      this.startRound();
    }
  }

  startRound() {
    const secret = this.getSecretAnswer();
    const maxPoints = this.getMaxPoints();

    if (!this.validateSecretAnswer(secret)) {
      return;
    }

    this.emitStartRound(secret, maxPoints);
  }

  getSecretAnswer() {
    return this.elements.secretInput.value.trim();
  }

  getMaxPoints() {
    const value = parseInt(this.elements.maxPointsInput.value);
    return isNaN(value) ? 200 : value;
  }

  validateSecretAnswer(secret) {
    if (!secret) {
      alert("Digite a resposta secreta antes de iniciar a rodada");
      return false;
    }
    return true;
  }

  emitStartRound(secret, maxPoints) {
    this.socket.emit("startRound", {
      secretAnswer: secret,
      maxPoints,
    });
  }

  handleRoundStarted({ secret, maxPoints }) {
    this.disableStartButton();
    this.enableCancelButton();
    this.clearBuzzedPlayer();
    this.updateStatus("🎯 Rodada em andamento...");
  }

  cancelRound() {
    this.socket.emit("cancelRound");
  }

  handleRoundReset() {
    this.enableStartButton();
    this.disableCancelButton();
    this.clearBuzzedPlayer();
    this.clearTimer();
    this.updateStatus("Pronto para nova rodada");
  }

  handleRoundTimeout() {
    this.handleRoundReset();
    this.updateStatus("⏰ Tempo esgotado!");
  }

  handleRoundContinued() {
    this.clearBuzzedPlayer();
    this.updateStatus("Rodada continuando...");
  }

  handleBuzzed({ playerId, name }) {
    this.showBuzzedPlayer(playerId, name);
    this.updateStatus(`🚨 ${name} apertou o buzzer!`);
  }

  showBuzzedPlayer(playerId, name) {
    this.elements.buzzedPlayer.style.display = "block";
    this.elements.buzzedPlayer.querySelector("span").textContent = name;
    this.elements.correctButton.onclick = () => this.markAnswer(true, playerId);
    this.elements.incorrectButton.onclick = () =>
      this.markAnswer(false, playerId);
  }

  clearBuzzedPlayer() {
    this.elements.buzzedPlayer.style.display = "none";
  }

  markAnswer(correct, playerId) {
    if (!playerId) return;

    this.socket.emit("answerResult", { playerId, correct });
  }

  updateTimer({ remaining }) {
    this.elements.timerDisplay.textContent = `Tempo: ${remaining}s`;
  }

  clearTimer() {
    this.elements.timerDisplay.textContent = "";
  }

  updateScores(scores) {
    this.elements.scores.innerHTML = "";

    scores.forEach((player, index) => {
      const row = this.createScoreRow(player, index);
      this.elements.scores.appendChild(row);
    });
  }

  createScoreRow(player, index) {
    const row = document.createElement("tr");
    row.className = index === 0 ? "leader" : "";

    const blockedStatus = player.blocked
      ? `🚫 Bloqueado (${player.blockedTime}s)`
      : "✅ Disponível";

    row.innerHTML = `
      <td>${player.name}</td>
      <td>${player.score}</td>
      <td>${blockedStatus}</td>
      <td>
        <button class="btn btn--danger btn--small" onclick="removePlayer('${player.playerId}')">
          Remover
        </button>
      </td>
    `;

    return row;
  }

  removePlayer(playerId) {
    if (confirm("Tem certeza que deseja remover este jogador?")) {
      this.socket.emit("removePlayer", { playerId });
    }
  }

  updateHistory(history) {
    this.elements.history.innerHTML = "";

    const recentHistory = history.slice(-15).reverse();

    recentHistory.forEach((entry) => {
      const row = this.createHistoryRow(entry);
      this.elements.history.appendChild(row);
    });
  }

  createHistoryRow(entry) {
    const row = document.createElement("tr");
    const icon = entry.correct ? "✅" : "❌";
    const status = entry.timeout
      ? "Tempo esgotado"
      : entry.cancelled
      ? "Cancelado"
      : entry.correct
      ? "Correto"
      : "Incorreto";

    row.innerHTML = `
      <td>${entry.timestamp}</td>
      <td>${entry.playerName}</td>
      <td>${icon} ${status}</td>
      <td>${entry.points}</td>
    `;

    return row;
  }

  endGame() {
    if (
      confirm(
        "Tem certeza que deseja encerrar o jogo? Todos os jogadores serão desconectados."
      )
    ) {
      this.socket.emit("endGame");
    }
  }

  enableStartButton() {
    this.elements.startButton.disabled = false;
  }

  disableStartButton() {
    this.elements.startButton.disabled = true;
  }

  enableCancelButton() {
    this.elements.cancelButton.disabled = false;
  }

  disableCancelButton() {
    this.elements.cancelButton.disabled = true;
  }

  updateStatus(message) {
    console.log("Status:", message);
  }

  showError(message) {
    alert(`Erro: ${message}`);
  }

  redirectToCreate() {
    window.location.href = "/create.html";
  }
}

// Função global para remover jogador (chamada pelos botões)
function removePlayer(playerId) {
  if (window.gameAdmin) {
    window.gameAdmin.removePlayer(playerId);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.gameAdmin = new GameAdmin();
});
