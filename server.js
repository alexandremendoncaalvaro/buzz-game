const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Estado do jogo
const players = new Map();
const roundHistory = [];

let roundState = {
  secret: null,
  start: null,
  maxPoints: 200,
  buzzed: false,
  blocked: new Map(),
  buzzPlayerId: null,
  buzzDelta: null,
};

setInterval(() => {
  const adminBoard = Array.from(players.values()).map((p) => {
    const blockedAt = roundState.blocked.get(p.id) || 0;
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

  if (adminBoard.some((p) => p.blocked)) {
    io.of("/admin").emit("scoreUpdate", adminBoard);
  }
}, 1000);

// Admin (host) namespace
io.of("/admin").on("connection", (socket) => {
  socket.on("startRound", ({ secretAnswer, maxPoints }) => {
    roundState.secret = secretAnswer;
    roundState.start = Date.now();
    roundState.maxPoints = maxPoints || 200;
    roundState.buzzed = false;
    roundState.blocked.clear();
    io.of("/game").emit("roundStarted");
    io.of("/admin").emit("roundStarted", {
      secret: secretAnswer,
      maxPoints: roundState.maxPoints,
    });
  });

  socket.on("answerResult", ({ playerId, correct }) => {
    const player = players.get(playerId);
    if (!player) return;
    let earnedPoints = 0;
    if (correct && roundState.buzzDelta !== null) {
      earnedPoints = Math.max(
        0,
        roundState.maxPoints - Math.floor(roundState.buzzDelta / 1000)
      );
      player.score += earnedPoints;
    }

    roundHistory.push({
      playerName: player.name,
      correct,
      points: earnedPoints,
      secret: roundState.secret,
      timestamp: new Date().toLocaleTimeString(),
    });

    // Só bloqueia se a resposta estiver incorreta
    if (!correct) {
      const blockTime = Date.now();
      roundState.blocked.set(playerId, blockTime);
      io.of("/game")
        .to(playerId)
        .emit("blocked", { duration: 30000, startTime: blockTime });
    }

    const board = Array.from(players.values()).map((p) => ({
      name: p.name,
      score: p.score,
    }));
    const adminBoard = Array.from(players.values()).map((p) => {
      const blockedAt = roundState.blocked.get(p.id) || 0;
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

    io.of("/admin").emit("scoreUpdate", adminBoard);
    io.of("/game").emit("scoreUpdate", board);
    io.of("/admin").emit("historyUpdate", roundHistory);
    io.of("/game").emit("historyUpdate", roundHistory);

    io.of("/game").emit("answerProcessed", {
      correct,
      playerName: player.name,
      points: earnedPoints,
    });

    roundState = {
      secret: null,
      start: null,
      maxPoints: 200,
      buzzed: false,
      blocked: new Map(),
      buzzPlayerId: null,
      buzzDelta: null,
    };
    io.of("/game").emit("roundReset");
    io.of("/admin").emit("roundReset");
  });

  socket.on("cancelRound", () => {
    if (roundState.secret) {
      roundHistory.push({
        playerName: "Sistema",
        correct: false,
        points: 0,
        secret: roundState.secret,
        timestamp: new Date().toLocaleTimeString(),
        cancelled: true,
      });

      roundState = {
        secret: null,
        start: null,
        maxPoints: 200,
        buzzed: false,
        blocked: new Map(),
        buzzPlayerId: null,
        buzzDelta: null,
      };

      io.of("/game").emit("roundReset");
      io.of("/admin").emit("roundReset");
      io.of("/admin").emit("historyUpdate", roundHistory);
      io.of("/game").emit("historyUpdate", roundHistory);
    }
  });

  socket.on("removePlayer", ({ playerId }) => {
    const playerSocketId = Array.from(players.keys()).find((socketId) => {
      const player = players.get(socketId);
      return player && player.playerId === playerId;
    });

    if (playerSocketId) {
      players.delete(playerSocketId);

      const playerSocket = io.of("/game").sockets.get(playerSocketId);
      if (playerSocket) {
        playerSocket.emit("forceLogout");
        playerSocket.disconnect(true);
      }

      const board = Array.from(players.values()).map((p) => ({
        name: p.name,
        score: p.score,
      }));
      const adminBoard = Array.from(players.values()).map((p) => ({
        name: p.name,
        score: p.score,
        playerId: p.playerId,
      }));

      io.of("/admin").emit("scoreUpdate", adminBoard);
      io.of("/game").emit("scoreUpdate", board);
    }
  });

  const initialBoard = Array.from(players.values()).map((p) => ({
    name: p.name,
    score: p.score,
    playerId: p.playerId,
  }));
  socket.emit("scoreUpdate", initialBoard);
  socket.emit("historyUpdate", roundHistory);
});

// Player namespace
io.of("/game").on("connection", (socket) => {
  socket.on("join", ({ name, playerId }) => {
    let finalPlayerId = playerId;
    let playerScore = 0;

    if (playerId) {
      const existingPlayer = Array.from(players.values()).find(
        (p) => p.playerId === playerId
      );
      if (existingPlayer) {
        playerScore = existingPlayer.score;
        players.delete(existingPlayer.id);
      }
    }

    if (!finalPlayerId) {
      finalPlayerId =
        Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    players.set(socket.id, {
      id: socket.id,
      playerId: finalPlayerId,
      name,
      score: playerScore,
    });

    socket.emit("joined", { socketId: socket.id, playerId: finalPlayerId });
    const board = Array.from(players.values()).map((p) => ({
      name: p.name,
      score: p.score,
    }));
    const adminBoard = Array.from(players.values()).map((p) => ({
      name: p.name,
      score: p.score,
      playerId: p.playerId,
    }));
    io.of("/admin").emit("scoreUpdate", adminBoard);
    io.of("/game").emit("scoreUpdate", board);
    socket.emit("historyUpdate", roundHistory);
  });

  socket.on("getPlayerInfo", ({ playerId }) => {
    const existingPlayer = Array.from(players.values()).find(
      (p) => p.playerId === playerId
    );
    if (existingPlayer) {
      socket.emit("playerInfo", { name: existingPlayer.name });
    }
  });

  socket.on("logout", () => {
    const player = players.get(socket.id);
    if (player) {
      players.delete(socket.id);

      const board = Array.from(players.values()).map((p) => ({
        name: p.name,
        score: p.score,
      }));
      const adminBoard = Array.from(players.values()).map((p) => ({
        name: p.name,
        score: p.score,
        playerId: p.playerId,
      }));

      io.of("/admin").emit("scoreUpdate", adminBoard);
      io.of("/game").emit("scoreUpdate", board);
    }
  });

  socket.on("buzz", () => {
    const now = Date.now();
    if (roundState.buzzed) return;
    const blockedAt = roundState.blocked.get(socket.id) || 0;
    if (now - blockedAt < 30000) return;

    roundState.buzzed = true;
    roundState.buzzPlayerId = socket.id;
    roundState.buzzDelta = now - roundState.start;
    const player = players.get(socket.id);
    io.of("/game").emit("buzzed", { name: player.name });
    io.of("/admin").emit("buzzed", { playerId: socket.id, name: player.name });
  });
});

server.listen(3333, () => console.log("Server listening on port 3333"));
