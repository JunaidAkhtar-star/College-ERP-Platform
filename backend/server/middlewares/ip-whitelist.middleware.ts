/**
 * IP Whitelisting middleware — SRS §10.1
 * Restricts specific admin-only routes to a list of trusted IP addresses.
 *
 * Supports both exact IPs and CIDR notation (e.g. 192.168.1.0/24).
 * Enabled when ADMIN_IP_WHITELIST env var is set (comma-separated).
 * If not set, all IPs are allowed (suitable for development).
 *
 * Usage:
 *   router.use(ipWhitelist)   // on admin-only routers
 */
import type { Request, Response, NextFunction } from "express";
import { Forbidden } from "http-errors";
import { logger } from "../utils/logger.util";
import { isIP } from "net";

interface CidrEntry {
  base: number;
  mask: number;
  original: string;
}

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function parseCidr(entry: string): CidrEntry | null {
  if (entry.includes("/")) {
    const [ip, bits] = entry.split("/");
    if (!ip || !bits || isIP(ip) !== 4) return null;
    const maskBits = parseInt(bits, 10);
    if (isNaN(maskBits) || maskBits < 0 || maskBits > 32) return null;
    const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
    return { base: ipToInt(ip) & mask, mask, original: entry };
  }
  // Exact IP — treat as /32
  if (isIP(entry) === 6) return { base: 0, mask: 0, original: entry };
  if (isIP(entry) !== 4) return null;
  const n = ipToInt(entry);
  return { base: n, mask: 0xffffffff, original: entry };
}

import { configs } from "../configs";

/** Parse the whitelist once at startup */
const WHITELIST: CidrEntry[] = (configs.ADMIN_IP_WHITELIST ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(parseCidr)
  .filter((e): e is CidrEntry => e !== null);

function normalizeIp(ip: string | undefined): string {
  if (!ip) return "";
  // Strip IPv6-mapped IPv4 prefix
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function isAllowed(clientIp: string): boolean {
  // For non-IPv4 addresses (e.g. ::1), do an exact string match against originals
  if (!clientIp.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return WHITELIST.some((entry) => entry.original === clientIp);
  }
  const clientInt = ipToInt(clientIp);
  return WHITELIST.some((entry) => (clientInt & entry.mask) === entry.base);
}

export function ipWhitelist(req: Request, _res: Response, next: NextFunction): void {
  // If no whitelist configured, allow all
  if (WHITELIST.length === 0) {
    next();
    return;
  }

  const clientIp = normalizeIp(req.ip ?? (req.socket.remoteAddress as string));

  if (isAllowed(clientIp)) {
    next();
    return;
  }

  logger.warn(`[ipWhitelist] Blocked request from ${clientIp}`);
  next(new Forbidden("Access denied: IP not whitelisted"));
}
