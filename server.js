const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const os = require("os");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("trust proxy", true);
app.use(express.static("public"));

// Função para obter IP IPv4 local da máquina
function getLocalIPv4() {
  const networks = os.networkInterfaces();
  for (const name of Object.keys(networks)) {
    for (const net of networks[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

// Middleware para capturar IP real em rotas HTTP
app.use((req, res, next) => {
  req.realIP = req.ip;
  next();
});

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

// Atualiza status de bloqueio a cada segundo
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
      ip: p.ip,
      blocked: isBlocked,
      blockedTime: remainingTime,
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
        ip: p.ip,
        blocked: isBlocked,
        blockedTime: remainingTime,
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

    // Encerra a rodada automaticamente após validação
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

  // envia lista inicial de jogadores e placar
  const initialBoard = Array.from(players.values()).map((p) => ({
    name: p.name,
    score: p.score,
    ip: p.ip,
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

    // Captura o IP do cliente tentando diferentes métodos para obter IPv4
    let playerIP = "Desconhecido";

    // Tenta headers de proxy primeiro
    const forwardedFor = socket.handshake.headers["x-forwarded-for"];
    const realIP = socket.handshake.headers["x-real-ip"];
    const clientIP = socket.handshake.headers["x-client-ip"];
    const cfConnectingIP = socket.handshake.headers["cf-connecting-ip"];

    if (forwardedFor) {
      playerIP = forwardedFor.split(",")[0].trim();
    } else if (realIP) {
      playerIP = realIP;
    } else if (clientIP) {
      playerIP = clientIP;
    } else if (cfConnectingIP) {
      playerIP = cfConnectingIP;
    } else {
      playerIP = socket.handshake.address;
    }

    // Remove prefixo IPv6 se presente
    if (playerIP.startsWith("::ffff:")) {
      playerIP = playerIP.substring(7);
    }

    // Se ainda for IPv6 ou localhost, tenta obter IP local da máquina
    if (playerIP.includes(":") && !playerIP.includes(".")) {
      playerIP = getLocalIPv4();
    }

    // Se for loopback, também usa o IP local da máquina
    if (playerIP === "127.0.0.1" || playerIP === "::1") {
      const localIP = getLocalIPv4();
      if (localIP !== "127.0.0.1") {
        playerIP = localIP;
      }
    }
    players.set(socket.id, {
      id: socket.id,
      playerId: finalPlayerId,
      name,
      score: playerScore,
      ip: playerIP,
    });

    socket.emit("joined", { socketId: socket.id, playerId: finalPlayerId });
    const board = Array.from(players.values()).map((p) => ({
      name: p.name,
      score: p.score,
    }));
    const adminBoard = Array.from(players.values()).map((p) => ({
      name: p.name,
      score: p.score,
      ip: p.ip,
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
