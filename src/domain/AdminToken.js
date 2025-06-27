class AdminToken {
  constructor(value) {
    this.validateToken(value);
    this.value = value;
  }

  validateToken(value) {
    if (!value || typeof value !== "string") {
      throw new Error("Admin token must be a non-empty string");
    }
    if (!value.startsWith("admin-")) {
      throw new Error('Admin token must start with "admin-"');
    }
  }

  toString() {
    return this.value;
  }

  equals(other) {
    return other instanceof AdminToken && this.value === other.value;
  }
}

module.exports = AdminToken;
