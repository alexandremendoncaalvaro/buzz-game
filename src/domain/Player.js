const PlayerName = require("./PlayerName");
const Score = require("./Score");
const PlayerId = require("./PlayerId");

class Player {
  constructor(socketId, playerId, name, score = 0) {
    this.identity = {
      socketId,
      playerId: new PlayerId(playerId),
      name: new PlayerName(name),
    };
    this.gameState = {
      score: new Score(score),
      disconnected: false,
      disconnectedAt: null,
    };
  }

  getName() {
    return this.identity.name.toString();
  }

  getPlayerId() {
    return this.identity.playerId.toString();
  }

  getSocketId() {
    return this.identity.socketId;
  }

  getScore() {
    return this.gameState.score.toNumber();
  }

  addPoints(points) {
    this.gameState.score = this.gameState.score.add(points);
  }

  markDisconnected() {
    this.gameState.disconnected = true;
    this.gameState.disconnectedAt = Date.now();
  }

  isDisconnected() {
    return this.gameState.disconnected;
  }

  toPlayerBoard() {
    return {
      name: this.getName(),
      score: this.getScore(),
    };
  }

  toAdminBoard(isBlocked = false, blockedTime = 0) {
    return {
      name: this.getName(),
      score: this.getScore(),
      blocked: isBlocked,
      blockedTime,
      playerId: this.getPlayerId(),
    };
  }
}

module.exports = Player;
