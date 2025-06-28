require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

app.get("/", (req, res) => {
  res.redirect("/create.html");
});

app.use(express.static("public"));

const gameRooms = new Map();

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

    const adminBoard = Array.from(this.players.values()).map((p) => ({
      name: p.name,
      score: p.score,
      blocked: false,
      blockedTime: 0,
      playerId: p.playerId,
    }));

    const playerBoard = Array.from(this.players.values()).map((p) => ({
      name: p.name,
      score: p.score,
    }));

    io.to(`admin-${this.adminToken}`).emit("scoreUpdate", adminBoard);
    io.to(`game-${this.gameToken}`).emit("scoreUpdate", playerBoard);
    io.to(`game-${this.gameToken}`).emit("roundReset");
    io.to(`admin-${this.adminToken}`).emit("roundReset");
  }
}

let roundTimer = null;

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

setInterval(() => {
  const now = Date.now();

  gameRooms.forEach((room) => {
    let needsUpdate = false;
    const playersToUnblock = [];

    const hasActiveRound = room.roundState.start !== null;
    const hasBlockedPlayers = room.roundState.blocked.size > 0;

    if (!hasActiveRound && !hasBlockedPlayers) {
      return;
    }

    const adminBoard = Array.from(room.players.values()).map((p) => {
      const blockedAt = room.roundState.blocked.get(p.id) || 0;
      const isBlocked = blockedAt > 0 && now - blockedAt < 30000;
      const remainingTime = isBlocked
        ? Math.ceil((30000 - (now - blockedAt)) / 1000)
        : 0;

      if (blockedAt > 0 && !isBlocked) {
        room.roundState.blocked.delete(p.id);
        playersToUnblock.push(p.id);
        needsUpdate = true;
      }

      return {
        name: p.name,
        score: p.score,
        blocked: isBlocked && remainingTime > 0,
        blockedTime: remainingTime > 0 ? remainingTime : 0,
        playerId: p.playerId,
      };
    });

    playersToUnblock.forEach((playerId) => {
      io.to(playerId).emit("unblocked");
    });

    if (adminBoard.some((p) => p.blocked) || needsUpdate) {
      io.to(`admin-${room.adminToken}`).emit("scoreUpdate", adminBoard);
    }

    if (room.roundState.start && !room.roundState.paused) {
      const elapsed =
        now - room.roundState.start - room.roundState.totalPausedTime;
      const remaining = Math.ceil(
        (room.roundState.maxPoints * 1000 - elapsed) / 1000
      );

      if (remaining <= 0) {
        room.roundHistory.push({
          playerName: "Sistema",
          correct: false,
          points: 0,
          secret: room.roundState.secret,
          timestamp: new Date().toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }),
          timeout: true,
        });

        io.to(`admin-${room.adminToken}`).emit("roundTimeout");
        io.to(`game-${room.gameToken}`).emit("roundTimeout");
        room.resetRound();

        io.to(`admin-${room.adminToken}`).emit(
          "historyUpdate",
          room.roundHistory
        );
        io.to(`game-${room.gameToken}`).emit(
          "historyUpdate",
          room.roundHistory
        );
      } else {
        io.to(`admin-${room.adminToken}`).emit("roundTimer", { remaining });
      }
    }
  });
}, 1000);

io.on("connection", (socket) => {
  socket.on("admin-join", ({ adminToken }) => {
    const room = getGameRoom(adminToken);
    if (!room) {
      socket.emit("error", { message: "Sala não encontrada" });
      return;
    }

    socket.join(`admin-${adminToken}`);
    socket.room = room;
    socket.isAdmin = true;

    const initialBoard = Array.from(room.players.values()).map((p) => ({
      name: p.name,
      score: p.score,
      playerId: p.playerId,
    }));

    socket.emit("joined", {
      gameToken: room.gameToken,
      roomTitle: room.roomTitle,
    });
    socket.emit("scoreUpdate", initialBoard);
    socket.emit("historyUpdate", room.roundHistory);
  });

  socket.on("player-join", ({ gameToken, name, playerId }) => {
    const room = getGameRoom(null, gameToken);
    if (!room) {
      socket.emit("error", { message: "Sala não encontrada" });
      return;
    }

    let finalPlayerId = playerId;
    let playerScore = 0;
    let existingPlayer = null;

    if (playerId) {
      existingPlayer = Array.from(room.players.values()).find(
        (p) => p.playerId === playerId
      );
      if (existingPlayer) {
        playerScore = existingPlayer.score;
        room.players.delete(existingPlayer.id);
      }
    }

    if (!finalPlayerId) {
      finalPlayerId =
        Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    room.players.set(socket.id, {
      id: socket.id,
      playerId: finalPlayerId,
      name: existingPlayer ? existingPlayer.name : name,
      score: playerScore,
      disconnected: false,
    });

    socket.join(`game-${gameToken}`);
    socket.room = room;
    socket.isPlayer = true;

    socket.emit("joined", {
      socketId: socket.id,
      playerId: finalPlayerId,
      roomTitle: room.roomTitle,
    });

    const board = Array.from(room.players.values())
      .filter((p) => !p.disconnected)
      .map((p) => ({
        name: p.name,
        score: p.score,
      }));
    const adminBoard = Array.from(room.players.values())
      .filter((p) => !p.disconnected)
      .map((p) => ({
        name: p.name,
        score: p.score,
        playerId: p.playerId,
      }));

    io.to(`admin-${room.adminToken}`).emit("scoreUpdate", adminBoard);
    io.to(`game-${room.gameToken}`).emit("scoreUpdate", board);
    socket.emit("historyUpdate", room.roundHistory);
  });
  socket.on("startRound", ({ secretAnswer, maxPoints }) => {
    if (!socket.isAdmin || !socket.room) return;

    const room = socket.room;
    room.roundState.secret = secretAnswer;
    room.roundState.start = Date.now();
    room.roundState.maxPoints = maxPoints || 200;
    room.roundState.buzzed = false;
    room.roundState.blocked.clear();
    room.roundState.paused = false;
    room.roundState.pausedAt = null;
    room.roundState.totalPausedTime = 0;

    io.to(`game-${room.gameToken}`).emit("roundStarted");
    io.to(`admin-${room.adminToken}`).emit("roundStarted", {
      secret: secretAnswer,
      maxPoints: room.roundState.maxPoints,
    });
  });

  socket.on("answerResult", ({ playerId, correct }) => {
    if (!socket.isAdmin || !socket.room) return;

    const room = socket.room;
    const player = room.players.get(playerId);
    if (!player) return;

    if (room.roundState.paused) {
      room.roundState.totalPausedTime += Date.now() - room.roundState.pausedAt;
      room.roundState.paused = false;
      room.roundState.pausedAt = null;
    }

    let earnedPoints = 0;
    if (correct && room.roundState.buzzDelta !== null) {
      earnedPoints = Math.max(
        0,
        room.roundState.maxPoints - Math.floor(room.roundState.buzzDelta / 1000)
      );
      player.score += earnedPoints;
    }

    room.roundHistory.push({
      playerName: player.name,
      correct,
      points: earnedPoints,
      secret: room.roundState.secret,
      timestamp: new Date().toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      }),
    });

    io.to(`game-${room.gameToken}`).emit("answerProcessed", {
      correct,
      playerName: player.name,
      points: earnedPoints,
      secret: correct ? room.roundState.secret : null,
    });

    io.to(`admin-${room.adminToken}`).emit("historyUpdate", room.roundHistory);
    io.to(`game-${room.gameToken}`).emit("historyUpdate", room.roundHistory);

    if (correct) {
      room.resetRound();
      io.to(`admin-${room.adminToken}`).emit(
        "historyUpdate",
        room.roundHistory
      );
      io.to(`game-${room.gameToken}`).emit("historyUpdate", room.roundHistory);
      return;
    }

    const blockTime = Date.now();
    room.roundState.blocked.set(player.id, blockTime);
    room.roundState.buzzed = false;
    room.roundState.buzzPlayerId = null;
    room.roundState.buzzDelta = null;

    io.to(playerId).emit("blocked", { duration: 30000, startTime: blockTime });

    const board = Array.from(room.players.values()).map((p) => ({
      name: p.name,
      score: p.score,
    }));
    const adminBoard = Array.from(room.players.values()).map((p) => {
      const blockedAt = room.roundState.blocked.get(p.id) || 0;
      const isBlocked = blockedAt > 0 && Date.now() - blockedAt < 30000;
      const remainingTime = isBlocked
        ? Math.ceil((30000 - (Date.now() - blockedAt)) / 1000)
        : 0;

      return {
        name: p.name,
        score: p.score,
        blocked: isBlocked,
        blockedTime: remainingTime,
        playerId: p.playerId,
      };
    });

    io.to(`admin-${room.adminToken}`).emit("scoreUpdate", adminBoard);
    io.to(`game-${room.gameToken}`).emit("scoreUpdate", board);
    io.to(`admin-${room.adminToken}`).emit("roundContinued");
  });

  socket.on("cancelRound", () => {
    if (!socket.isAdmin || !socket.room) return;

    const room = socket.room;
    if (room.roundState.secret) {
      room.roundHistory.push({
        playerName: "Sistema",
        correct: false,
        points: 0,
        secret: room.roundState.secret,
        timestamp: new Date().toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        cancelled: true,
      });

      room.resetRound();
      io.to(`admin-${room.adminToken}`).emit(
        "historyUpdate",
        room.roundHistory
      );
      io.to(`game-${room.gameToken}`).emit("historyUpdate", room.roundHistory);
    }
  });

  socket.on("removePlayer", ({ playerId }) => {
    if (!socket.isAdmin || !socket.room) return;

    const room = socket.room;
    const playerSocketId = Array.from(room.players.keys()).find((socketId) => {
      const player = room.players.get(socketId);
      return player && player.playerId === playerId;
    });

    if (playerSocketId) {
      room.players.delete(playerSocketId);

      const playerSocket = io.sockets.sockets.get(playerSocketId);
      if (playerSocket) {
        playerSocket.emit("forceLogout");
        playerSocket.disconnect(true);
      }

      const board = Array.from(room.players.values()).map((p) => ({
        name: p.name,
        score: p.score,
      }));
      const adminBoard = Array.from(room.players.values()).map((p) => ({
        name: p.name,
        score: p.score,
        playerId: p.playerId,
      }));

      io.to(`admin-${room.adminToken}`).emit("scoreUpdate", adminBoard);
      io.to(`game-${room.gameToken}`).emit("scoreUpdate", board);
    }
  });

  socket.on("endGame", () => {
    if (!socket.isAdmin || !socket.room) return;

    const room = socket.room;

    Array.from(room.players.values()).forEach((player) => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit("gameEnded", {
          message: "O jogo foi encerrado pelo administrador",
        });
        playerSocket.disconnect(true);
      }
    });

    gameRooms.delete(room.adminToken);
    socket.disconnect(true);
  });

  socket.on("getPlayerInfo", ({ playerId, gameToken }) => {
    if (!playerId || !gameToken) return;

    const room = getGameRoom(null, gameToken);
    if (!room) return;

    const existingPlayer = Array.from(room.players.values()).find(
      (p) => p.playerId === playerId
    );
    if (existingPlayer) {
      socket.emit("playerInfo", { name: existingPlayer.name });
    }
  });

  socket.on("logout", () => {
    if (!socket.room || !socket.isPlayer) return;

    const room = socket.room;
    const player = room.players.get(socket.id);
    if (player) {
      room.players.delete(socket.id);

      const board = Array.from(room.players.values())
        .filter((p) => !p.disconnected)
        .map((p) => ({
          name: p.name,
          score: p.score,
        }));
      const adminBoard = Array.from(room.players.values())
        .filter((p) => !p.disconnected)
        .map((p) => ({
          name: p.name,
          score: p.score,
          playerId: p.playerId,
        }));

      io.to(`admin-${room.adminToken}`).emit("scoreUpdate", adminBoard);
      io.to(`game-${room.gameToken}`).emit("scoreUpdate", board);
    }
  });

  socket.on("buzz", () => {
    if (!socket.room || !socket.isPlayer) return;

    const room = socket.room;
    const now = Date.now();
    if (room.roundState.buzzed) return;
    if (!room.roundState.start) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const blockedAt = room.roundState.blocked.get(player.id) || 0;
    if (now - blockedAt < 30000) return;

    room.roundState.buzzed = true;
    room.roundState.buzzPlayerId = socket.id;
    room.roundState.buzzDelta =
      now - room.roundState.start - room.roundState.totalPausedTime;

    room.roundState.paused = true;
    room.roundState.pausedAt = now;

    io.to(`game-${room.gameToken}`).emit("buzzed", { name: player.name });
    io.to(`admin-${room.adminToken}`).emit("buzzed", {
      playerId: socket.id,
      name: player.name,
    });
  });

  socket.on("disconnect", () => {
    if (socket.room && socket.isPlayer) {
      const room = socket.room;
      const player = room.players.get(socket.id);
      if (player) {
        player.disconnected = true;
        player.disconnectedAt = Date.now();
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
