import crypto from "crypto";

/** OTP length and expiry settings. */
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

export const otpUtil = {
  /** Generate a numeric OTP string of fixed length. */
  generate(): string {
    const max = Math.pow(10, OTP_LENGTH);
    const otp = crypto.randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
    return otp;
  },

  /** Returns the expiry Date object from now. */
  expiryDate(): Date {
    return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  },

  /** Check if an OTP's stored expiry has passed. */
  isExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  },
};
