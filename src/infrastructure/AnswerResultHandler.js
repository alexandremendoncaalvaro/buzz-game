class AnswerResultHandler {
  constructor(io) {
    this.io = io;
  }

  handle(socket, data) {
    if (!this.canProcessAnswer(socket)) {
      return;
    }

    const { playerId, correct } = data;
    const room = socket.room;
    const player = room.getPlayer(playerId);

    if (!player) {
      return;
    }

    const result = room.processAnswer(playerId, correct);

    this.broadcastAnswerResult(room, player, correct, result.points);
    this.updateScores(room);

    if (result.shouldResetRound) {
      this.handleCorrectAnswer(room);
      return;
    }

    this.handleIncorrectAnswer(room, player);
  }

  canProcessAnswer(socket) {
    return socket.isAdmin && socket.room;
  }

  broadcastAnswerResult(room, player, correct, points) {
    this.io.to(`game-${room.getGameToken()}`).emit("answerProcessed", {
      correct,
      playerName: player.getName(),
      points,
      secret: correct ? room.getRoundSecret() : null,
    });

    this.broadcastHistoryUpdate(room);
  }

  updateScores(room) {
    const playerBoard = room.createPlayerBoard();
    const adminBoard = room.createAdminBoard();

    this.io.to(`admin-${room.getAdminToken()}`).emit("scoreUpdate", adminBoard);
    this.io.to(`game-${room.getGameToken()}`).emit("scoreUpdate", playerBoard);
  }

  handleCorrectAnswer(room) {
    room.resetRound();
    this.broadcastHistoryUpdate(room);
  }

  handleIncorrectAnswer(room, player) {
    this.io.to(player.getSocketId()).emit("blocked", {
      duration: 30000,
      startTime: Date.now(),
    });
    this.io.to(`admin-${room.getAdminToken()}`).emit("roundContinued");
  }

  broadcastHistoryUpdate(room) {
    const history = room.getRoundHistory();
    this.io.to(`admin-${room.getAdminToken()}`).emit("historyUpdate", history);
    this.io.to(`game-${room.getGameToken()}`).emit("historyUpdate", history);
  }
}

module.exports = AnswerResultHandler;
