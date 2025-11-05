const crypto = require('crypto');
const Student = require('../models/StudentModel');

/**
 * Generate a user-friendly unique key for students
 * Format: STU-{YEAR}-{SEQUENCE} or STU-{LOCATION}-{YEAR}-{SEQUENCE}
 * Examples: STU-2024-001, STU-ATH-2024-001, STU-TH-2024-001
 */
class KeyGenerator {
  constructor() {
    this.prefix = 'STU';
  }

  // Crockford Base32 alphabet (no I, L, O, U to avoid confusion)
  static BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  static toBase32(buffer) {
    const alphabet = KeyGenerator.BASE32_ALPHABET;
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }
    return output;
  }

  static checksum(input) {
    // Simple mod-32 checksum over bytes
    const hash = crypto.createHash('sha1').update(input).digest();
    const sum = hash[0] ^ hash[1] ^ hash[2] ^ hash[3] ^ hash[4];
    return KeyGenerator.BASE32_ALPHABET[sum % 32];
  }

  /**
   * Generate a unique key for a student
   * @param {string} location - Optional location code (ATH, TH, PAT, HER, LAR)
   * @returns {Promise<string>} Generated unique key
   */
  async generateUniqueKey() {
    try {
      const year = new Date().getFullYear();
      // Try a few times to avoid rare collisions
      for (let attempt = 0; attempt < 5; attempt++) {
        const rand = crypto.randomBytes(5); // 40 bits ~ base32 length 8
        const randBase32 = KeyGenerator.toBase32(rand).slice(0, 6); // 6 chars
        const base = `${this.prefix}-${year}-${randBase32}`;
        const check = KeyGenerator.checksum(base);
        const uniqueKey = `${base}-${check}`;

        const exists = await Student.findOne({ uniqueKey });
        if (!exists) {
          return uniqueKey;
        }
      }
      // Fallback: add one more random char
      const extra = KeyGenerator.BASE32_ALPHABET[crypto.randomInt(32)];
      const year2 = new Date().getFullYear();
      const base = `${this.prefix}-${year2}-${extra}${crypto.randomInt(10)}${extra}`;
      const check = KeyGenerator.checksum(base);
      return `${base}-${check}`;
    } catch (error) {
      console.error('Error generating unique key:', error);
      throw new Error('Failed to generate unique key');
    }
  }

  /**
   * Generate multiple unique keys at once
   * @param {number} count - Number of keys to generate
   * @param {string} location - Optional location code
   * @returns {Promise<string[]>} Array of generated unique keys
   */
  async generateMultipleKeys(count) {
    const keys = [];
    for (let i = 0; i < count; i++) {
      const key = await this.generateUniqueKey();
      keys.push(key);
    }
    return keys;
  }

  /**
   * Validate a unique key format
   * @param {string} key - Key to validate
   * @returns {boolean} True if valid format
   */
  validateKeyFormat(key) {
    // STU-YYYY-XXXXXX-C where X/C are Crockford base32 chars
    return /^STU-\d{4}-[0-9A-HJKMNP-TV-Z]{6}-[0-9A-HJKMNP-TV-Z]$/.test(key);
  }

  /**
   * Get available location codes
   * @returns {Object} Available locations with codes and names
   */
  getAvailableLocations() {
    return this.locations;
  }

  /**
   * Parse a unique key to extract information
   * @param {string} key - Key to parse
   * @returns {Object|null} Parsed information or null if invalid
   */
  parseKey(key) {
    if (!this.validateKeyFormat(key)) {
      return null;
    }

    const parts = key.split('-');
    if (parts.length === 4) {
      return {
        prefix: parts[0],
        year: parseInt(parts[1]),
        random: parts[2],
        checksum: parts[3]
      };
    }

    return null;
  }

  /**
   * Generate a preview of what keys would look like
   * @param {number} count - Number of preview keys
   * @param {string} location - Optional location code
   * @returns {Promise<string[]>} Preview keys (not saved to database)
   */
  async generatePreview(count = 5) {
    const previewKeys = [];
    for (let i = 0; i < count; i++) {
      const year = new Date().getFullYear();
      const rand = crypto.randomBytes(5);
      const randBase32 = KeyGenerator.toBase32(rand).slice(0, 6);
      const base = `${this.prefix}-${year}-${randBase32}`;
      const check = KeyGenerator.checksum(base);
      previewKeys.push(`${base}-${check}`);
    }
    return previewKeys;
  }
}

module.exports = new KeyGenerator();
