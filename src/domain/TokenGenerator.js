class TokenGenerator {
  generateAdminToken() {
    return `admin-${Math.random().toString(36).substr(2, 12)}`;
  }

  generateGameToken() {
    return `game-${Math.random().toString(36).substr(2, 8)}`;
  }
}

module.exports = TokenGenerator;
