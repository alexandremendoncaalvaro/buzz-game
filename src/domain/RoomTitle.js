class RoomTitle {
  constructor(value) {
    this.value = value || "Buzz Game";
  }

  toString() {
    return this.value;
  }

  equals(other) {
    return other instanceof RoomTitle && this.value === other.value;
  }
}

module.exports = RoomTitle;
