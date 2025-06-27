const request = require("supertest");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Client = require("socket.io-client");

let app, server, io, gameRooms;

function createTestServer() {
  app = express();
  server = http.createServer(app);
  io = new Server(server);
  app.use(express.json());
  gameRooms = new Map();

  class GameRoom {
    constructor(adminToken, gameToken, roomTitle = "Buzz Game") {
      this.adminToken = adminToken;
      this.gameToken = gameToken;
      this.roomTitle = roomTitle;
      this.players = new Map();
      this.roundHistory = [];
      this.roundState = {
        secret: null,
        start: null,
        maxPoints: 200,
        buzzed: false,
        blocked: new Map(),
        buzzPlayerId: null,
        buzzDelta: null,
        paused: false,
        pausedAt: null,
        totalPausedTime: 0,
      };
    }

    resetRound() {
      this.roundState = {
        secret: null,
        start: null,
        maxPoints: 200,
        buzzed: false,
        blocked: new Map(),
        buzzPlayerId: null,
        buzzDelta: null,
        paused: false,
        pausedAt: null,
        totalPausedTime: 0,
      };
    }
  }

  function getGameRoom(adminToken, gameToken) {
    if (adminToken) {
      return Array.from(gameRooms.values()).find(
        (room) => room.adminToken === adminToken
      );
    }
    if (gameToken) {
      return Array.from(gameRooms.values()).find(
        (room) => room.gameToken === gameToken
      );
    }
    return null;
  }

  app.post("/create-game", (req, res) => {
    const adminToken = `admin-${Math.random().toString(36).substr(2, 12)}`;
    const gameToken = `game-${Math.random().toString(36).substr(2, 8)}`;
    const roomTitle = (req.body && req.body.title) || "Buzz Game";

    const room = new GameRoom(adminToken, gameToken, roomTitle);
    gameRooms.set(adminToken, room);

    res.json({ adminToken, gameToken, roomTitle });
  });

  app.get("/game-info/:gameToken", (req, res) => {
    const { gameToken } = req.params;
    const room = getGameRoom(null, gameToken);

    if (!room) {
      return res.status(404).json({ error: "Sala não encontrada" });
    }

    res.json({ roomTitle: room.roomTitle });
  });

  return { app, server, io, gameRooms, GameRoom, getGameRoom };
}

describe("Buzz Game API", () => {
  beforeEach((done) => {
    const testServer = createTestServer();
    app = testServer.app;
    server = testServer.server;
    io = testServer.io;
    gameRooms = testServer.gameRooms;
    server.listen(() => done());
  });

  afterEach((done) => {
    server.close(done);
  });

  describe("POST /create-game", () => {
    it("deve criar um novo jogo com título padrão", async () => {
      const response = await request(app).post("/create-game").send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("adminToken");
      expect(response.body).toHaveProperty("gameToken");
      expect(response.body).toHaveProperty("roomTitle", "Buzz Game");
      expect(response.body.adminToken).toMatch(/^admin-/);
      expect(response.body.gameToken).toMatch(/^game-/);
    });

    it("deve criar um novo jogo com título customizado", async () => {
      const customTitle = "Quiz da Empresa";
      const response = await request(app)
        .post("/create-game")
        .send({ title: customTitle });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("roomTitle", customTitle);
    });

    it("deve armazenar o jogo no mapa de salas", async () => {
      const response = await request(app)
        .post("/create-game")
        .send({ title: "Test Room" });

      const room = gameRooms.get(response.body.adminToken);
      expect(room).toBeDefined();
      expect(room.roomTitle).toBe("Test Room");
      expect(room.adminToken).toBe(response.body.adminToken);
      expect(room.gameToken).toBe(response.body.gameToken);
    });
  });

  describe("GET /game-info/:gameToken", () => {
    let gameToken;

    beforeEach(async () => {
      const response = await request(app)
        .post("/create-game")
        .send({ title: "Test Room" });
      gameToken = response.body.gameToken;
    });

    it("deve retornar informações da sala existente", async () => {
      const response = await request(app).get(`/game-info/${gameToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("roomTitle", "Test Room");
    });

    it("deve retornar 404 para sala inexistente", async () => {
      const response = await request(app).get("/game-info/invalid-token");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Sala não encontrada");
    });
  });
});

describe("GameRoom Class", () => {
  let GameRoom;

  beforeEach(() => {
    const testServer = createTestServer();
    GameRoom = testServer.GameRoom;
  });

  it("deve criar uma instância com valores padrão", () => {
    const room = new GameRoom("admin-123", "game-456");

    expect(room.adminToken).toBe("admin-123");
    expect(room.gameToken).toBe("game-456");
    expect(room.roomTitle).toBe("Buzz Game");
    expect(room.players).toBeInstanceOf(Map);
    expect(room.roundHistory).toEqual([]);
    expect(room.roundState.secret).toBeNull();
    expect(room.roundState.maxPoints).toBe(200);
    expect(room.roundState.buzzed).toBe(false);
  });

  it("deve criar uma instância com título customizado", () => {
    const room = new GameRoom("admin-123", "game-456", "Custom Title");

    expect(room.roomTitle).toBe("Custom Title");
  });

  it("deve resetar o estado da rodada", () => {
    const room = new GameRoom("admin-123", "game-456");

    room.roundState.secret = "test answer";
    room.roundState.start = Date.now();
    room.roundState.buzzed = true;
    room.roundState.blocked.set("player1", Date.now());

    room.resetRound();

    expect(room.roundState.secret).toBeNull();
    expect(room.roundState.start).toBeNull();
    expect(room.roundState.buzzed).toBe(false);
    expect(room.roundState.blocked.size).toBe(0);
    expect(room.roundState.maxPoints).toBe(200);
  });
});
