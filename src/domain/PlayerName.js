class PlayerName {
  constructor(value) {
    this.validateName(value);
    this.value = value;
  }

  validateName(value) {
    if (!value || typeof value !== "string" || value.trim().length === 0) {
      throw new Error("Player name must be a non-empty string");
    }
  }

  toString() {
    return this.value;
  }

  equals(other) {
    return other instanceof PlayerName && this.value === other.value;
  }
}

module.exports = PlayerName;
