const Player = require("../domain/Player");

class PlayerJoinHandler {
  constructor(gameRoomManager, io) {
    this.gameRoomManager = gameRoomManager;
    this.io = io;
  }

  handle(socket, data) {
    const { gameToken, name, playerId } = data;
    const room = this.gameRoomManager.findRoomByGameToken(gameToken);

    if (!room) {
      socket.emit("error", { message: "Sala não encontrada" });
      return;
    }

    const playerData = this.processPlayerData(room, playerId, name);
    const player = this.createPlayer(socket.id, playerData);

    this.addPlayerToRoom(socket, room, player);
    this.sendJoinConfirmation(socket, player, room);
    this.broadcastUpdatedScores(room);
  }

  processPlayerData(room, playerId, name) {
    if (!playerId) {
      return { playerId: null, name, score: 0 };
    }

    const existingPlayer = room.findPlayerByPlayerId(playerId);
    if (existingPlayer) {
      room.removePlayer(existingPlayer.getSocketId());
      return {
        playerId,
        name: existingPlayer.getName(),
        score: existingPlayer.getScore(),
      };
    }

    return { playerId, name, score: 0 };
  }

  createPlayer(socketId, playerData) {
    return new Player(
      socketId,
      playerData.playerId,
      playerData.name,
      playerData.score
    );
  }

  addPlayerToRoom(socket, room, player) {
    room.addPlayer(player);
    socket.join(`game-${room.getGameToken()}`);
    socket.room = room;
    socket.isPlayer = true;
  }

  sendJoinConfirmation(socket, player, room) {
    socket.emit("joined", {
      socketId: socket.id,
      playerId: player.getPlayerId(),
      roomTitle: room.getRoomTitle(),
    });
    socket.emit("historyUpdate", room.getRoundHistory());
  }

  broadcastUpdatedScores(room) {
    const playerBoard = room.createPlayerBoard();
    const adminBoard = room.createAdminBoard();

    this.io.to(`admin-${room.getAdminToken()}`).emit("scoreUpdate", adminBoard);
    this.io.to(`game-${room.getGameToken()}`).emit("scoreUpdate", playerBoard);
  }
}

module.exports = PlayerJoinHandler;
