class PlayerId {
  constructor(value) {
    this.value = value || this.generateId();
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  toString() {
    return this.value;
  }

  equals(other) {
    return other instanceof PlayerId && this.value === other.value;
  }
}

module.exports = PlayerId;
