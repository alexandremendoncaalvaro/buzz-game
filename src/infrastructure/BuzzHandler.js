class BuzzHandler {
  constructor(io) {
    this.io = io;
  }

  handle(socket) {
    if (!this.canProcessBuzz(socket)) {
      return;
    }

    const room = socket.room;
    const player = room.getPlayer(socket.id);

    const buzzProcessed = room.processBuzz(socket.id);
    if (!buzzProcessed) {
      return;
    }

    this.broadcastBuzz(room, player);
  }

  canProcessBuzz(socket) {
    return socket.room && socket.isPlayer;
  }

  broadcastBuzz(room, player) {
    this.io.to(`game-${room.getGameToken()}`).emit("buzzed", {
      name: player.getName(),
    });
    this.io.to(`admin-${room.getAdminToken()}`).emit("buzzed", {
      playerId: player.getSocketId(),
      name: player.getName(),
    });
  }
}

module.exports = BuzzHandler;
