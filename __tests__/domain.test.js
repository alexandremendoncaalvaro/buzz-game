const AdminToken = require("../src/domain/AdminToken");
const GameToken = require("../src/domain/GameToken");
const RoomTitle = require("../src/domain/RoomTitle");
const Score = require("../src/domain/Score");
const PlayerName = require("../src/domain/PlayerName");
const PlayerId = require("../src/domain/PlayerId");
const Player = require("../src/domain/Player");

describe("Domain Objects", () => {
  describe("AdminToken", () => {
    it("deve criar um token de admin válido", () => {
      const token = new AdminToken("admin-123456");
      expect(token.toString()).toBe("admin-123456");
    });

    it("deve rejeitar token inválido", () => {
      expect(() => new AdminToken("invalid-token")).toThrow();
      expect(() => new AdminToken("")).toThrow();
      expect(() => new AdminToken(null)).toThrow();
    });

    it("deve comparar tokens corretamente", () => {
      const token1 = new AdminToken("admin-123");
      const token2 = new AdminToken("admin-123");
      const token3 = new AdminToken("admin-456");

      expect(token1.equals(token2)).toBe(true);
      expect(token1.equals(token3)).toBe(false);
    });
  });

  describe("GameToken", () => {
    it("deve criar um token de jogo válido", () => {
      const token = new GameToken("game-abc123");
      expect(token.toString()).toBe("game-abc123");
    });

    it("deve rejeitar token inválido", () => {
      expect(() => new GameToken("invalid-token")).toThrow();
      expect(() => new GameToken("")).toThrow();
    });
  });

  describe("Score", () => {
    it("deve criar uma pontuação válida", () => {
      const score = new Score(100);
      expect(score.toNumber()).toBe(100);
    });

    it("deve criar pontuação zero por padrão", () => {
      const score = new Score();
      expect(score.toNumber()).toBe(0);
    });

    it("deve adicionar pontos corretamente", () => {
      const score = new Score(50);
      const newScore = score.add(25);
      expect(newScore.toNumber()).toBe(75);
      expect(score.toNumber()).toBe(50); // original não muda
    });

    it("deve rejeitar pontuação negativa", () => {
      expect(() => new Score(-10)).toThrow();
    });
  });

  describe("PlayerName", () => {
    it("deve criar um nome válido", () => {
      const name = new PlayerName("João");
      expect(name.toString()).toBe("João");
    });

    it("deve rejeitar nome inválido", () => {
      expect(() => new PlayerName("")).toThrow();
      expect(() => new PlayerName("   ")).toThrow();
      expect(() => new PlayerName(null)).toThrow();
    });
  });

  describe("PlayerId", () => {
    it("deve criar um ID com valor fornecido", () => {
      const id = new PlayerId("player-123");
      expect(id.toString()).toBe("player-123");
    });

    it("deve gerar um ID automaticamente se não fornecido", () => {
      const id = new PlayerId();
      expect(id.toString()).toBeTruthy();
      expect(id.toString().length).toBeGreaterThan(0);
    });
  });

  describe("Player", () => {
    it("deve criar um jogador com dados válidos", () => {
      const player = new Player("socket-123", "player-456", "João", 100);

      expect(player.getName()).toBe("João");
      expect(player.getPlayerId()).toBe("player-456");
      expect(player.getSocketId()).toBe("socket-123");
      expect(player.getScore()).toBe(100);
      expect(player.isDisconnected()).toBe(false);
    });

    it("deve criar jogador com pontuação zero por padrão", () => {
      const player = new Player("socket-123", "player-456", "João");
      expect(player.getScore()).toBe(0);
    });

    it("deve adicionar pontos corretamente", () => {
      const player = new Player("socket-123", "player-456", "João", 50);
      player.addPoints(25);
      expect(player.getScore()).toBe(75);
    });

    it("deve marcar como desconectado", () => {
      const player = new Player("socket-123", "player-456", "João");
      player.markDisconnected();
      expect(player.isDisconnected()).toBe(true);
    });

    it("deve criar dados para placar do jogador", () => {
      const player = new Player("socket-123", "player-456", "João", 100);
      const board = player.toPlayerBoard();

      expect(board).toEqual({
        name: "João",
        score: 100,
      });
    });

    it("deve criar dados para placar do admin", () => {
      const player = new Player("socket-123", "player-456", "João", 100);
      const board = player.toAdminBoard(true, 15);

      expect(board).toEqual({
        name: "João",
        score: 100,
        blocked: true,
        blockedTime: 15,
        playerId: "player-456",
      });
    });
  });
});
