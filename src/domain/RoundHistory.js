class RoundHistoryEntry {
  constructor(
    playerName,
    correct,
    points,
    secret,
    timeout = false,
    cancelled = false
  ) {
    this.playerName = playerName;
    this.correct = correct;
    this.points = points;
    this.secret = secret;
    this.timestamp = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    this.timeout = timeout;
    this.cancelled = cancelled;
  }

  toObject() {
    return {
      playerName: this.playerName,
      correct: this.correct,
      points: this.points,
      secret: this.secret,
      timestamp: this.timestamp,
      ...(this.timeout && { timeout: this.timeout }),
      ...(this.cancelled && { cancelled: this.cancelled }),
    };
  }
}

class RoundHistory {
  constructor() {
    this.entries = [];
  }

  addEntry(
    playerName,
    correct,
    points,
    secret,
    timeout = false,
    cancelled = false
  ) {
    const entry = new RoundHistoryEntry(
      playerName,
      correct,
      points,
      secret,
      timeout,
      cancelled
    );
    this.entries.push(entry);
  }

  addTimeoutEntry(secret) {
    this.addEntry("Sistema", false, 0, secret, true, false);
  }

  addCancelledEntry(secret) {
    this.addEntry("Sistema", false, 0, secret, false, true);
  }

  toArray() {
    return this.entries.map((entry) => entry.toObject());
  }

  clear() {
    this.entries = [];
  }
}

module.exports = { RoundHistory, RoundHistoryEntry };
