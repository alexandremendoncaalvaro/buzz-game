const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const GameRoomManager = require("./application/GameRoomManager");
const AdminJoinHandler = require("./infrastructure/AdminJoinHandler");
const PlayerJoinHandler = require("./infrastructure/PlayerJoinHandler");
const BuzzHandler = require("./infrastructure/BuzzHandler");
const AnswerResultHandler = require("./infrastructure/AnswerResultHandler");

class BuzzGameServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server);
    this.gameRoomManager = new GameRoomManager();

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeSocketHandlers();
    this.startGameTimer();
  }

  initializeMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static("public"));
  }

  initializeRoutes() {
    this.app.get("/", (req, res) => {
      res.redirect("/create.html");
    });

    this.app.post("/create-game", (req, res) => {
      const roomTitle = req.body?.title;
      const result = this.gameRoomManager.createRoom(roomTitle);
      res.json(result);
    });

    this.app.get("/game-info/:gameToken", (req, res) => {
      const { gameToken } = req.params;
      const room = this.gameRoomManager.findRoomByGameToken(gameToken);

      if (!room) {
        return res.status(404).json({ error: "Sala não encontrada" });
      }

      res.json({ roomTitle: room.getRoomTitle() });
    });
  }

  initializeSocketHandlers() {
    const adminJoinHandler = new AdminJoinHandler(
      this.gameRoomManager,
      this.io
    );
    const playerJoinHandler = new PlayerJoinHandler(
      this.gameRoomManager,
      this.io
    );
    const buzzHandler = new BuzzHandler(this.io);
    const answerResultHandler = new AnswerResultHandler(this.io);

    this.io.on("connection", (socket) => {
      socket.on("admin-join", (data) => adminJoinHandler.handle(socket, data));
      socket.on("player-join", (data) =>
        playerJoinHandler.handle(socket, data)
      );
      socket.on("buzz", () => buzzHandler.handle(socket));
      socket.on("answerResult", (data) =>
        answerResultHandler.handle(socket, data)
      );

      this.handleRemainingEvents(socket);
    });
  }

  handleRemainingEvents(socket) {
    socket.on("startRound", ({ secretAnswer, maxPoints }) => {
      if (!socket.isAdmin || !socket.room) return;

      socket.room.startRound(secretAnswer, maxPoints);

      this.io.to(`game-${socket.room.getGameToken()}`).emit("roundStarted");
      this.io.to(`admin-${socket.room.getAdminToken()}`).emit("roundStarted", {
        secret: secretAnswer,
        maxPoints: maxPoints || 200,
      });
    });

    socket.on("cancelRound", () => {
      if (!socket.isAdmin || !socket.room) return;

      socket.room.cancelRound();
      const history = socket.room.getRoundHistory();

      this.io
        .to(`admin-${socket.room.getAdminToken()}`)
        .emit("historyUpdate", history);
      this.io
        .to(`game-${socket.room.getGameToken()}`)
        .emit("historyUpdate", history);
    });

    socket.on("disconnect", () => {
      if (socket.room && socket.isPlayer) {
        const player = socket.room.getPlayer(socket.id);
        if (player) {
          player.markDisconnected();
        }
      }
    });
  }

  startGameTimer() {
    setInterval(() => {
      this.processGameUpdates();
    }, 1000);
  }

  processGameUpdates() {
    const now = Date.now();

    this.gameRoomManager.getAllRooms().forEach((room) => {
      this.processRoomUpdates(room, now);
    });
  }

  processRoomUpdates(room, now) {
    const hasActiveRound = room.hasActiveRound();
    const hasBlockedPlayers = room.createAdminBoard().some((p) => p.blocked);

    if (!hasActiveRound && !hasBlockedPlayers) {
      return;
    }

    this.updateBlockedPlayers(room);
    this.checkRoundTimeout(room);
  }

  updateBlockedPlayers(room) {
    const adminBoard = room.createAdminBoard();

    if (adminBoard.some((p) => p.blocked)) {
      this.io
        .to(`admin-${room.getAdminToken()}`)
        .emit("scoreUpdate", adminBoard);
    }

    adminBoard
      .filter((p) => !p.blocked && p.blockedTime === 0)
      .forEach((p) => {
        const player = room.findPlayerByPlayerId(p.playerId);
        if (player) {
          this.io.to(player.getSocketId()).emit("unblocked");
        }
      });
  }

  checkRoundTimeout(room) {
    if (!room.hasActiveRound()) return;

    const remaining = room.getRemainingTime();

    if (remaining <= 0) {
      room.handleTimeout();
      this.broadcastTimeout(room);
      return;
    }

    this.io
      .to(`admin-${room.getAdminToken()}`)
      .emit("roundTimer", { remaining });
  }

  broadcastTimeout(room) {
    this.io.to(`admin-${room.getAdminToken()}`).emit("roundTimeout");
    this.io.to(`game-${room.getGameToken()}`).emit("roundTimeout");

    const history = room.getRoundHistory();
    this.io.to(`admin-${room.getAdminToken()}`).emit("historyUpdate", history);
    this.io.to(`game-${room.getGameToken()}`).emit("historyUpdate", history);
  }

  start(port = 3000) {
    this.server.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  }
}

module.exports = BuzzGameServer;
