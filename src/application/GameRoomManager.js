const GameRoom = require("../domain/GameRoom");
const TokenGenerator = require("../domain/TokenGenerator");

class GameRoomManager {
  constructor() {
    this.rooms = new Map();
    this.tokenGenerator = new TokenGenerator();
  }

  createRoom(roomTitle) {
    const adminToken = this.tokenGenerator.generateAdminToken();
    const gameToken = this.tokenGenerator.generateGameToken();

    const room = new GameRoom(adminToken, gameToken, roomTitle);
    this.rooms.set(adminToken, room);

    return {
      adminToken,
      gameToken,
      roomTitle: room.getRoomTitle(),
    };
  }

  findRoomByAdminToken(adminToken) {
    return this.rooms.get(adminToken);
  }

  findRoomByGameToken(gameToken) {
    return Array.from(this.rooms.values()).find(
      (room) => room.getGameToken() === gameToken
    );
  }

  removeRoom(adminToken) {
    this.rooms.delete(adminToken);
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }
}

module.exports = GameRoomManager;
