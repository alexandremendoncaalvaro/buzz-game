class RoundState {
  constructor() {
    this.resetState();
  }

  resetState() {
    this.secret = null;
    this.start = null;
    this.maxPoints = 200;
    this.buzzed = false;
    this.blocked = new Map();
    this.buzzPlayerId = null;
    this.buzzDelta = null;
    this.paused = false;
    this.pausedAt = null;
    this.totalPausedTime = 0;
  }

  startRound(secretAnswer, maxPoints = 200) {
    this.secret = secretAnswer;
    this.start = Date.now();
    this.maxPoints = maxPoints;
    this.buzzed = false;
    this.blocked.clear();
    this.paused = false;
    this.pausedAt = null;
    this.totalPausedTime = 0;
  }

  processBuzz(playerId) {
    if (this.buzzed || !this.start) {
      return false;
    }

    const now = Date.now();
    const blockedAt = this.blocked.get(playerId) || 0;
    if (now - blockedAt < 30000) {
      return false;
    }

    this.buzzed = true;
    this.buzzPlayerId = playerId;
    this.buzzDelta = now - this.start - this.totalPausedTime;
    this.pauseRound();

    return true;
  }

  pauseRound() {
    this.paused = true;
    this.pausedAt = Date.now();
  }

  resumeRound() {
    if (this.paused) {
      this.totalPausedTime += Date.now() - this.pausedAt;
      this.paused = false;
      this.pausedAt = null;
    }
  }

  blockPlayer(playerId) {
    this.blocked.set(playerId, Date.now());
    this.buzzed = false;
    this.buzzPlayerId = null;
    this.buzzDelta = null;
  }

  calculatePoints() {
    if (this.buzzDelta === null) return 0;
    return Math.max(0, this.maxPoints - Math.floor(this.buzzDelta / 1000));
  }

  isPlayerBlocked(playerId) {
    const blockedAt = this.blocked.get(playerId) || 0;
    return blockedAt > 0 && Date.now() - blockedAt < 30000;
  }

  getBlockedTimeRemaining(playerId) {
    const blockedAt = this.blocked.get(playerId) || 0;
    if (blockedAt === 0) return 0;

    const remaining = 30000 - (Date.now() - blockedAt);
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  getRemainingTime() {
    if (!this.start || this.paused) return this.maxPoints;

    const elapsed = Date.now() - this.start - this.totalPausedTime;
    return Math.ceil((this.maxPoints * 1000 - elapsed) / 1000);
  }

  hasTimedOut() {
    return this.getRemainingTime() <= 0;
  }

  hasActiveRound() {
    return this.start !== null;
  }
}

module.exports = RoundState;
