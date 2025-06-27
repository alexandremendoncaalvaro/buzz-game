class Score {
  constructor(value = 0) {
    this.validateScore(value);
    this.value = value;
  }

  validateScore(value) {
    if (typeof value !== "number" || value < 0) {
      throw new Error("Score must be a non-negative number");
    }
  }

  add(points) {
    return new Score(this.value + points);
  }

  toNumber() {
    return this.value;
  }

  equals(other) {
    return other instanceof Score && this.value === other.value;
  }
}

module.exports = Score;
