/**
 * AES-256-GCM encryption utility.
 * Used to encrypt sensitive fields at rest (MFA secrets, Aadhaar numbers, etc.)
 * as required by SRS §10.2.
 *
 * Key: ENCRYPTION_KEY env var — 32-byte hex string (64 hex chars).
 * Generates a random 12-byte IV per encryption; prepends it to ciphertext.
 * Output format: base64("<iv:12bytes><authTag:16bytes><ciphertext>")
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { logger } from "./logger.util";
import { configs } from "../configs";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit IV recommended for GCM
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = configs.ENCRYPTION_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(hex)) {
    if (configs.NODE_ENV === "production") {
      logger.error(
        "[crypto] ENCRYPTION_KEY must contain exactly 64 hexadecimal characters (32 bytes). Exiting.",
      );
      process.exit(1);
    }
    // In dev: derive a stable but insecure key from a constant — never use in prod
    return Buffer.from("0".repeat(64), "hex");
  }
  return Buffer.from(hex, "hex");
}

export const cryptoUtil = {
  /**
   * Encrypt a plaintext string. Returns a base64-encoded string.
   */
  encrypt(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Layout: iv (12) + tag (16) + ciphertext
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
  },

  /**
   * Decrypt a base64-encoded ciphertext string.
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext) return "";
    try {
      const key = getKey();
      const buf = Buffer.from(ciphertext, "base64");
      const iv = buf.subarray(0, IV_LEN);
      const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
      const encrypted = buf.subarray(IV_LEN + TAG_LEN);
      const decipher = createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted) + decipher.final("utf8");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const err = new Error(`Decryption failed (key mismatch or payload corrupted): ${msg}`);
      (err as { cause?: unknown }).cause = error;
      throw err;
    }
  },
};
