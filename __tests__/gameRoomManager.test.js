const GameRoomManager = require("../src/application/GameRoomManager");

describe("GameRoomManager", () => {
  let manager;

  beforeEach(() => {
    manager = new GameRoomManager();
  });

  describe("createRoom", () => {
    it("deve criar uma sala com título padrão", () => {
      const result = manager.createRoom();

      expect(result.adminToken).toMatch(/^admin-/);
      expect(result.gameToken).toMatch(/^game-/);
      expect(result.roomTitle).toBe("Buzz Game");
    });

    it("deve criar uma sala com título customizado", () => {
      const result = manager.createRoom("Quiz da Empresa");
      expect(result.roomTitle).toBe("Quiz da Empresa");
    });

    it("deve armazenar a sala no mapa", () => {
      const result = manager.createRoom("Test Room");
      const room = manager.findRoomByAdminToken(result.adminToken);

      expect(room).toBeDefined();
      expect(room.getRoomTitle()).toBe("Test Room");
    });
  });

  describe("findRoomByAdminToken", () => {
    it("deve encontrar sala pelo token de admin", () => {
      const result = manager.createRoom("Test Room");
      const room = manager.findRoomByAdminToken(result.adminToken);

      expect(room).toBeDefined();
      expect(room.getAdminToken()).toBe(result.adminToken);
    });

    it("deve retornar undefined para token inexistente", () => {
      const room = manager.findRoomByAdminToken("invalid-token");
      expect(room).toBeUndefined();
    });
  });

  describe("findRoomByGameToken", () => {
    it("deve encontrar sala pelo token de jogo", () => {
      const result = manager.createRoom("Test Room");
      const room = manager.findRoomByGameToken(result.gameToken);

      expect(room).toBeDefined();
      expect(room.getGameToken()).toBe(result.gameToken);
    });

    it("deve retornar undefined para token inexistente", () => {
      const room = manager.findRoomByGameToken("invalid-token");
      expect(room).toBeUndefined();
    });
  });

  describe("removeRoom", () => {
    it("deve remover uma sala existente", () => {
      const result = manager.createRoom("Test Room");

      let room = manager.findRoomByAdminToken(result.adminToken);
      expect(room).toBeDefined();

      manager.removeRoom(result.adminToken);
      room = manager.findRoomByAdminToken(result.adminToken);
      expect(room).toBeUndefined();
    });
  });

  describe("getAllRooms", () => {
    it("deve retornar todas as salas", () => {
      manager.createRoom("Room 1");
      manager.createRoom("Room 2");
      manager.createRoom("Room 3");

      const rooms = manager.getAllRooms();
      expect(rooms).toHaveLength(3);
    });

    it("deve retornar array vazio quando não há salas", () => {
      const rooms = manager.getAllRooms();
      expect(rooms).toEqual([]);
    });
  });
});
