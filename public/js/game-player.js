class GamePlayer {
  constructor() {
    this.socket = io();
    this.gameToken = this.extractGameToken();
    this.playerId = this.extractPlayerId();
    this.isConnected = false;
    this.countdownInterval = null;

    this.initializeElements();
    this.bindEvents();
    this.loadGameInfo();
    this.attemptReconnection();
  }

  initializeElements() {
    this.elements = {
      gameTitle: document.getElementById("gameTitle"),
      loginSection: document.getElementById("login"),
      gameSection: document.getElementById("game"),
      nameInput: document.getElementById("name"),
      joinButton: document.getElementById("join"),
      logoutButton: document.getElementById("logout"),
      playerName: document.getElementById("playerName"),
      status: document.getElementById("status"),
      buzzButton: document.getElementById("buzz"),
      buzzContainer: document.getElementById("buzzContainer"),
      blockedMessage: document.getElementById("blockedMessage"),
      countdown: document.getElementById("countdown"),
      scores: document.getElementById("scores"),
      history: document.getElementById("history"),
    };
  }

  bindEvents() {
    this.elements.joinButton.addEventListener("click", () => this.handleJoin());
    this.elements.nameInput.addEventListener("keypress", (e) =>
      this.handleNameKeyPress(e)
    );
    this.elements.logoutButton.addEventListener("click", () =>
      this.handleLogout()
    );
    this.elements.buzzButton.addEventListener("click", () => this.handleBuzz());

    document.addEventListener("keydown", (e) => this.handleKeyDown(e));

    this.bindSocketEvents();
  }

  bindSocketEvents() {
    this.socket.on("joined", (data) => this.handleJoined(data));
    this.socket.on("playerInfo", (data) => this.handlePlayerInfo(data));
    this.socket.on("scoreUpdate", (data) => this.updateScores(data));
    this.socket.on("historyUpdate", (data) => this.updateHistory(data));
    this.socket.on("roundStarted", () => this.handleRoundStarted());
    this.socket.on("roundReset", () => this.handleRoundReset());
    this.socket.on("roundTimeout", () => this.handleRoundTimeout());
    this.socket.on("buzzed", (data) => this.handleBuzzed(data));
    this.socket.on("answerProcessed", (data) =>
      this.handleAnswerProcessed(data)
    );
    this.socket.on("blocked", (data) => this.handleBlocked(data));
    this.socket.on("unblocked", () => this.handleUnblocked());
    this.socket.on("forceLogout", () => this.handleForceLogout());
    this.socket.on("gameEnded", (data) => this.handleGameEnded(data));
    this.socket.on("error", (error) => this.showError(error.message));
  }

  extractGameToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("game");

    if (!token) {
      this.redirectToCreate();
    }

    return token;
  }

  extractPlayerId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("id");
  }

  async loadGameInfo() {
    if (!this.gameToken) return;

    try {
      const response = await fetch(`/game-info/${this.gameToken}`);

      if (!response.ok) {
        throw new Error("Game not found");
      }

      const { roomTitle } = await response.json();
      this.updateGameTitle(roomTitle);
    } catch (error) {
      console.error("Error loading game info:", error);
      this.redirectToCreate();
    }
  }

  updateGameTitle(title) {
    this.elements.gameTitle.textContent = title;
    document.title = title;
  }

  attemptReconnection() {
    if (this.playerId) {
      this.socket.emit("getPlayerInfo", {
        playerId: this.playerId,
        gameToken: this.gameToken,
      });
    }
  }

  handlePlayerInfo({ name }) {
    if (name) {
      this.joinGame(name, this.playerId);
    }
  }

  handleNameKeyPress(event) {
    if (event.key === "Enter") {
      this.handleJoin();
    }
  }

  handleJoin() {
    const name = this.getPlayerName();

    if (!this.validatePlayerName(name)) {
      return;
    }

    this.joinGame(name);
  }

  getPlayerName() {
    return this.elements.nameInput.value.trim();
  }

  validatePlayerName(name) {
    if (!name) {
      alert("Por favor, digite seu nome");
      return false;
    }
    return true;
  }

  joinGame(name, existingPlayerId) {
    const playerId = existingPlayerId || this.generatePlayerId();

    this.updateUrlWithPlayerId(playerId);
    this.emitPlayerJoin(name, playerId);
    this.showGameInterface(name);
  }

  generatePlayerId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  updateUrlWithPlayerId(playerId) {
    const newUrl = `${window.location.pathname}?game=${this.gameToken}&id=${playerId}`;
    window.history.replaceState({}, "", newUrl);
  }

  emitPlayerJoin(name, playerId) {
    this.socket.emit("player-join", {
      gameToken: this.gameToken,
      name,
      playerId,
    });
  }

  showGameInterface(name) {
    this.elements.loginSection.style.display = "none";
    this.elements.gameSection.style.display = "block";
    this.elements.playerName.textContent = `Jogador: ${name}`;
    this.isConnected = true;
  }

  handleJoined({ playerId, roomTitle }) {
    if (roomTitle) {
      this.updateGameTitle(roomTitle);
    }
  }

  handleLogout() {
    this.socket.emit("logout");
    this.redirectToCreate();
  }

  handleKeyDown(event) {
    if (event.code === "Space" && this.canBuzz()) {
      event.preventDefault();
      this.handleBuzz();
    }
  }

  handleBuzz() {
    if (!this.canBuzz()) return;

    this.socket.emit("buzz");
    this.disableBuzz();
  }

  canBuzz() {
    return (
      this.isConnected &&
      !this.elements.buzzButton.disabled &&
      this.elements.buzzContainer.style.display !== "none"
    );
  }

  disableBuzz() {
    this.elements.buzzButton.disabled = true;
  }

  enableBuzz() {
    this.elements.buzzButton.disabled = false;
  }

  handleRoundStarted() {
    this.updateStatus("🎯 Rodada iniciada! Fique atento...");
    this.showBuzzContainer();
    this.enableBuzz();
  }

  handleRoundReset() {
    this.updateStatus("Aguardando próxima rodada...");
    this.hideBuzzContainer();
    this.hideBlockedMessage();
  }

  handleRoundTimeout() {
    this.updateStatus("⏰ Tempo esgotado!");
    this.hideBuzzContainer();
  }

  handleBuzzed({ name }) {
    this.updateStatus(`🚨 ${name} apertou o buzzer!`);
    this.disableBuzz();
  }

  handleAnswerProcessed({ correct, playerName, points, secret }) {
    if (correct) {
      this.updateStatus(`✅ ${playerName} acertou! (+${points} pontos)`);
      if (secret) {
        this.updateStatus(`Resposta: ${secret}`);
      }
    } else {
      this.updateStatus(`❌ ${playerName} errou!`);
    }
  }

  handleBlocked({ duration, startTime }) {
    this.showBlockedMessage();
    this.startCountdown(duration / 1000);
  }

  handleUnblocked() {
    this.hideBlockedMessage();
    this.enableBuzz();
  }

  showBlockedMessage() {
    this.elements.blockedMessage.style.display = "block";
    this.hideBuzzContainer();
  }

  hideBlockedMessage() {
    this.elements.blockedMessage.style.display = "none";
    this.clearCountdown();
  }

  startCountdown(seconds) {
    this.clearCountdown();

    let remaining = seconds;
    this.elements.countdown.textContent = remaining;

    this.countdownInterval = setInterval(() => {
      remaining--;
      this.elements.countdown.textContent = remaining;

      if (remaining <= 0) {
        this.clearCountdown();
      }
    }, 1000);
  }

  clearCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  showBuzzContainer() {
    this.elements.buzzContainer.style.display = "block";
  }

  hideBuzzContainer() {
    this.elements.buzzContainer.style.display = "none";
  }

  updateStatus(message) {
    this.elements.status.textContent = message;
  }

  updateScores(scores) {
    this.elements.scores.innerHTML = "";

    scores.forEach((player, index) => {
      const li = this.createScoreItem(player, index === 0);
      this.elements.scores.appendChild(li);
    });
  }

  createScoreItem(player, isLeader) {
    const li = document.createElement("li");
    li.className = `score-item ${isLeader ? "score-item--leader" : ""}`;
    li.textContent = `${player.name}: ${player.score} pontos`;
    return li;
  }

  updateHistory(history) {
    this.elements.history.innerHTML = "";

    const recentHistory = history.slice(-10).reverse();

    recentHistory.forEach((entry) => {
      const li = this.createHistoryItem(entry);
      this.elements.history.appendChild(li);
    });
  }

  createHistoryItem(entry) {
    const li = document.createElement("li");
    const icon = entry.correct ? "✅" : "❌";
    const status = entry.timeout
      ? "Tempo esgotado"
      : entry.cancelled
      ? "Cancelado"
      : entry.correct
      ? "Correto"
      : "Incorreto";

    li.textContent = `[${entry.timestamp}] ${icon} ${entry.playerName} - ${status}`;
    return li;
  }

  handleForceLogout() {
    alert("Você foi removido da sala pelo administrador");
    this.redirectToCreate();
  }

  handleGameEnded({ message }) {
    alert(message);
    this.redirectToCreate();
  }

  showError(message) {
    alert(`Erro: ${message}`);
  }

  redirectToCreate() {
    window.location.href = "/create.html";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new GamePlayer();
});
