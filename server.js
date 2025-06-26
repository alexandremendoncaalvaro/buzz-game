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
  paused: false,
  pausedAt: null,
  totalPausedTime: 0,
};

let roundTimer = null;

function resetRound() {
  roundState = {
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

  // Atualizar o board para admin (com informações completas)
  const adminBoard = Array.from(players.values()).map((p) => ({
    name: p.name,
    score: p.score,
    blocked: false,
    blockedTime: 0,
    playerId: p.playerId,
  }));

  // Atualizar o board para jogadores (versão simplificada)
  const playerBoard = Array.from(players.values()).map((p) => ({
    name: p.name,
    score: p.score,
  }));

  io.of("/admin").emit("scoreUpdate", adminBoard);
  io.of("/game").emit("scoreUpdate", playerBoard);
  io.of("/game").emit("roundReset");
  io.of("/admin").emit("roundReset");
}

setInterval(() => {
  const now = Date.now();
  let needsUpdate = false;
  const playersToUnblock = [];

  // Só processar bloqueios se há rodada ativa ou se há jogadores bloqueados
  const hasActiveRound = roundState.start !== null;
  const hasBlockedPlayers = roundState.blocked.size > 0;

  if (!hasActiveRound && !hasBlockedPlayers) {
    return; // Não fazer nada se não há rodada ativa nem jogadores bloqueados
  }

  const adminBoard = Array.from(players.values()).map((p) => {
    const blockedAt = roundState.blocked.get(p.id) || 0;
    const isBlocked = blockedAt > 0 && now - blockedAt < 30000;
    const remainingTime = isBlocked
      ? Math.ceil((30000 - (now - blockedAt)) / 1000)
      : 0;

    // Se o jogador estava bloqueado mas agora deve ser desbloqueado
    if (blockedAt > 0 && !isBlocked) {
      roundState.blocked.delete(p.id);
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

  // Notificar jogadores desbloqueados
  playersToUnblock.forEach((playerId) => {
    io.of("/game").to(playerId).emit("unblocked");
  });

  if (adminBoard.some((p) => p.blocked) || needsUpdate) {
    io.of("/admin").emit("scoreUpdate", adminBoard);
  }

  // Timer da rodada (apenas se há rodada ativa)
  if (roundState.start && !roundState.paused) {
    const elapsed = now - roundState.start - roundState.totalPausedTime;
    const remaining = Math.ceil((roundState.maxPoints * 1000 - elapsed) / 1000);

    if (remaining <= 0) {
      // Registrar no histórico que a rodada terminou por timeout
      roundHistory.push({
        playerName: "Sistema",
        correct: false,
        points: 0,
        secret: roundState.secret,
        timestamp: new Date().toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        timeout: true,
      });

      io.of("/admin").emit("roundTimeout");
      io.of("/game").emit("roundTimeout");
      resetRound();

      // Atualizar histórico após timeout
      io.of("/admin").emit("historyUpdate", roundHistory);
      io.of("/game").emit("historyUpdate", roundHistory);
    } else {
      io.of("/admin").emit("roundTimer", { remaining });
    }
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
    roundState.paused = false;
    roundState.pausedAt = null;
    roundState.totalPausedTime = 0;
    io.of("/game").emit("roundStarted");
    io.of("/admin").emit("roundStarted", {
      secret: secretAnswer,
      maxPoints: roundState.maxPoints,
    });
  });

  socket.on("answerResult", ({ playerId, correct }) => {
    const player = players.get(playerId);
    if (!player) return;

    // Retomar o timer que foi pausado durante o buzz
    if (roundState.paused) {
      roundState.totalPausedTime += Date.now() - roundState.pausedAt;
      roundState.paused = false;
      roundState.pausedAt = null;
    }

    let earnedPoints = 0;
    if (correct && roundState.buzzDelta !== null) {
      earnedPoints = Math.max(
        0,
        roundState.maxPoints - Math.floor(roundState.buzzDelta / 1000)
      );
      player.score += earnedPoints;
    }

    // Adicionar ao histórico SEMPRE, independente de certo ou errado
    roundHistory.push({
      playerName: player.name,
      correct,
      points: earnedPoints,
      secret: roundState.secret,
      timestamp: new Date().toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      }),
    });

    // Emitir answerProcessed primeiro
    io.of("/game").emit("answerProcessed", {
      correct,
      playerName: player.name,
      points: earnedPoints,
      secret: correct ? roundState.secret : null, // Só mostra resposta se acertou
    });

    // Atualizar histórico imediatamente após resposta
    io.of("/admin").emit("historyUpdate", roundHistory);
    io.of("/game").emit("historyUpdate", roundHistory); // Se a resposta estiver correta, encerra a rodada
    if (correct) {
      resetRound();

      // Re-emitir histórico após reset para garantir sincronização
      io.of("/admin").emit("historyUpdate", roundHistory);
      io.of("/game").emit("historyUpdate", roundHistory);
      return;
    }

    // Se incorreta, apenas bloqueia o jogador e continua a rodada
    const blockTime = Date.now();
    roundState.blocked.set(player.id, blockTime);
    roundState.buzzed = false;
    roundState.buzzPlayerId = null;
    roundState.buzzDelta = null;

    io.of("/game")
      .to(playerId) // Usar o playerId que é o socket.id
      .emit("blocked", { duration: 30000, startTime: blockTime });

    // Atualizar scores
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

    // Reseta o estado do buzz para permitir novos buzzes
    io.of("/admin").emit("roundContinued");
  });

  socket.on("cancelRound", () => {
    if (roundState.secret) {
      roundHistory.push({
        playerName: "Sistema",
        correct: false,
        points: 0,
        secret: roundState.secret,
        timestamp: new Date().toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        cancelled: true,
      });

      resetRound();
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
    if (!roundState.start) return;

    const player = players.get(socket.id);
    if (!player) return;

    const blockedAt = roundState.blocked.get(player.id) || 0;
    if (now - blockedAt < 30000) return;

    roundState.buzzed = true;
    roundState.buzzPlayerId = socket.id;
    roundState.buzzDelta = now - roundState.start - roundState.totalPausedTime;

    roundState.paused = true;
    roundState.pausedAt = now;

    io.of("/game").emit("buzzed", { name: player.name });
    io.of("/admin").emit("buzzed", { playerId: socket.id, name: player.name });
  });
});

server.listen(3333, () => console.log("Server listening on port 3333"));
