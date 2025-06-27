const AdminToken = require("./AdminToken");
const GameToken = require("./GameToken");
const RoomTitle = require("./RoomTitle");
const RoundState = require("./RoundState");
const { RoundHistory } = require("./RoundHistory");

class GameRoom {
  constructor(adminToken, gameToken, roomTitle) {
    this.tokens = {
      admin: new AdminToken(adminToken),
      game: new GameToken(gameToken),
    };
    this.metadata = {
      title: new RoomTitle(roomTitle),
      players: new Map(),
      roundState: new RoundState(),
      roundHistory: new RoundHistory(),
    };
  }

  getAdminToken() {
    return this.tokens.admin.toString();
  }

  getGameToken() {
    return this.tokens.game.toString();
  }

  getRoomTitle() {
    return this.metadata.title.toString();
  }

  addPlayer(player) {
    this.metadata.players.set(player.getSocketId(), player);
  }

  removePlayer(socketId) {
    this.metadata.players.delete(socketId);
  }

  getPlayer(socketId) {
    return this.metadata.players.get(socketId);
  }

  getAllPlayers() {
    return Array.from(this.metadata.players.values());
  }

  getActivePlayers() {
    return this.getAllPlayers().filter((player) => !player.isDisconnected());
  }

  findPlayerByPlayerId(playerId) {
    return this.getAllPlayers().find(
      (player) => player.getPlayerId() === playerId
    );
  }

  startRound(secret, maxPoints) {
    this.metadata.roundState.startRound(secret, maxPoints);
  }

  resetRound() {
    this.metadata.roundState.resetState();
  }

  processBuzz(playerId) {
    return this.metadata.roundState.processBuzz(playerId);
  }

  processAnswer(playerId, correct) {
    if (correct) {
      const points = this.metadata.roundState.calculatePoints();
      const player = this.getPlayer(playerId);
      if (player) {
        player.addPoints(points);
        this.metadata.roundHistory.addEntry(
          player.getName(),
          correct,
          points,
          this.metadata.roundState.secret
        );
      }
      return { points, shouldResetRound: true };
    }

    this.metadata.roundState.blockPlayer(playerId);
    const player = this.getPlayer(playerId);
    if (player) {
      this.metadata.roundHistory.addEntry(
        player.getName(),
        correct,
        0,
        this.metadata.roundState.secret
      );
    }
    return { points: 0, shouldResetRound: false };
  }

  getRoundHistory() {
    return this.metadata.roundHistory.toArray();
  }

  hasActiveRound() {
    return this.metadata.roundState.hasActiveRound();
  }

  hasTimedOut() {
    return this.metadata.roundState.hasTimedOut();
  }

  getRemainingTime() {
    return this.metadata.roundState.getRemainingTime();
  }

  createPlayerBoard() {
    return this.getActivePlayers().map((player) => player.toPlayerBoard());
  }

  createAdminBoard() {
    return this.getActivePlayers().map((player) => {
      const isBlocked = this.metadata.roundState.isPlayerBlocked(
        player.getSocketId()
      );
      const blockedTime = this.metadata.roundState.getBlockedTimeRemaining(
        player.getSocketId()
      );
      return player.toAdminBoard(isBlocked, blockedTime);
    });
  }

  handleTimeout() {
    this.metadata.roundHistory.addTimeoutEntry(this.metadata.roundState.secret);
    this.resetRound();
  }

  cancelRound() {
    if (this.metadata.roundState.secret) {
      this.metadata.roundHistory.addCancelledEntry(
        this.metadata.roundState.secret
      );
      this.resetRound();
    }
  }

  getRoundSecret() {
    return this.metadata.roundState.secret;
  }
}

module.exports = GameRoom;
