const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Estado do jogo
const players = new Map();

let roundState = {
  secret: null,
  start: null,
  maxPoints: 200,
  buzzed: false,
  blocked: new Map(),
};

// Admin (host) namespace
io.of("/admin").on("connection", (socket) => {
  socket.on("startRound", ({ secretAnswer, maxPoints }) => {
    roundState.secret = secretAnswer;
    roundState.start = Date.now();
    roundState.maxPoints = maxPoints || 200;
    roundState.buzzed = false;
    roundState.blocked.clear();
    io.of("/game").emit("roundStarted");
  });

  socket.on("answerResult", ({ playerId, correct }) => {
    const player = players.get(playerId);
    if (!player) return;
    const delta = Date.now() - roundState.start;
    if (correct) {
      const pts = Math.max(
        0,
        Math.ceil(roundState.maxPoints * (1 - delta / 5000))
      );
      player.score += pts;
    }
    roundState.blocked.set(playerId, Date.now());
    const board = Array.from(players.values()).map((p) => ({
      name: p.name,
      score: p.score,
    }));
    io.of("/admin").emit("scoreUpdate", board);
    io.of("/game").to(playerId).emit("blocked", 30000);
    io.of("/game").emit("answerProcessed", {
      correct,
      playerName: player.name,
    });
  });

  socket.on("nextRound", () => {
    roundState = {
      secret: null,
      start: null,
      maxPoints: 200,
      buzzed: false,
      blocked: new Map(),
    };
    io.of("/game").emit("roundReset");
  });

  // envia lista inicial de jogadores e placar
  socket.emit(
    "scoreUpdate",
    Array.from(players.values()).map((p) => ({ name: p.name, score: p.score }))
  );
});

// Player namespace
io.of("/game").on("connection", (socket) => {
  socket.on("join", ({ name }) => {
    players.set(socket.id, { id: socket.id, name, score: 0 });
    socket.emit("joined", socket.id);
    const board = Array.from(players.values()).map((p) => ({
      name: p.name,
      score: p.score,
    }));
    io.of("/admin").emit("scoreUpdate", board);
  });

  socket.on("buzz", () => {
    const now = Date.now();
    if (roundState.buzzed) return;
    const blockedAt = roundState.blocked.get(socket.id) || 0;
    if (now - blockedAt < 30000) return;

    roundState.buzzed = true;
    const delta = now - roundState.start;
    const player = players.get(socket.id);
    io.of("/game").emit("buzzed", { name: player.name });
    io.of("/admin").emit("buzzed", { playerId: socket.id, name: player.name });
  });
});

server.listen(3333, () => console.log("Server listening on port 3333"));
