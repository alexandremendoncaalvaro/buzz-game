class GameCreator {
  constructor() {
    this.titleInput = document.getElementById("roomTitle");
    this.createButton = document.getElementById("createGame");

    this.bindEvents();
  }

  bindEvents() {
    this.createButton.addEventListener("click", () => this.createGame());
    this.titleInput.addEventListener("keypress", (e) => this.handleKeyPress(e));
  }

  handleKeyPress(event) {
    if (event.key === "Enter") {
      this.createGame();
    }
  }

  async createGame() {
    const title = this.getGameTitle();

    try {
      const gameData = await this.requestGameCreation(title);
      this.redirectToAdmin(gameData);
    } catch (error) {
      this.showError();
    }
  }

  getGameTitle() {
    return this.titleInput.value.trim() || "Buzz Game";
  }

  async requestGameCreation(title) {
    const response = await fetch("/create-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      throw new Error("Failed to create game");
    }

    return response.json();
  }

  redirectToAdmin(gameData) {
    const { adminToken, gameToken } = gameData;
    window.location.href = `/admin.html?token=${adminToken}&game=${gameToken}`;
  }

  showError() {
    alert("Erro ao criar jogo. Tente novamente.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new GameCreator();
});
