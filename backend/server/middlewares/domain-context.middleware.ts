import type { RequestHandler } from "express";
import type { BackendDomainId } from "../platform";

/**
 * Adds immutable ownership context to a mounted domain router.
 *
 * Services can use this context for audit correlation without trusting a
 * client-supplied header. The response header is diagnostic only.
 */
export function domainContext(domain: BackendDomainId): RequestHandler {
  return (req, res, next) => {
    req.backendDomain = domain;
    res.locals.backendDomain = domain;
    res.setHeader("X-Devvelocity-Domain", domain);
    next();
  };
}
