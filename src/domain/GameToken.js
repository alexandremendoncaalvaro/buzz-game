class GameToken {
  constructor(value) {
    this.validateToken(value);
    this.value = value;
  }

  validateToken(value) {
    if (!value || typeof value !== "string") {
      throw new Error("Game token must be a non-empty string");
    }
    if (!value.startsWith("game-")) {
      throw new Error('Game token must start with "game-"');
    }
  }

  toString() {
    return this.value;
  }

  equals(other) {
    return other instanceof GameToken && this.value === other.value;
  }
}

module.exports = GameToken;
