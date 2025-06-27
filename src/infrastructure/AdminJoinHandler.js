class AdminJoinHandler {
  constructor(gameRoomManager, io) {
    this.gameRoomManager = gameRoomManager;
    this.io = io;
  }

  handle(socket, data) {
    const { adminToken } = data;
    const room = this.gameRoomManager.findRoomByAdminToken(adminToken);

    if (!room) {
      socket.emit("error", { message: "Sala não encontrada" });
      return;
    }

    this.joinAdminToRoom(socket, room);
    this.sendInitialData(socket, room);
  }

  joinAdminToRoom(socket, room) {
    socket.join(`admin-${room.getAdminToken()}`);
    socket.room = room;
    socket.isAdmin = true;
  }

  sendInitialData(socket, room) {
    const initialBoard = room.createAdminBoard();

    socket.emit("joined", {
      gameToken: room.getGameToken(),
      roomTitle: room.getRoomTitle(),
    });
    socket.emit("scoreUpdate", initialBoard);
    socket.emit("historyUpdate", room.getRoundHistory());
  }
}

module.exports = AdminJoinHandler;
