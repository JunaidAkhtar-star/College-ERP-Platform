import type { ValidationError } from "express-validator";
import { validationResult } from "express-validator";
import type { Request, Response, NextFunction } from "express";

/**
 * Collect express-validator errors and return a 422 with field-level details.
 * Must be placed after the validation chain middlewares.
 */
export function validate(req: Request, _res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((e: ValidationError) => ({
      field: "path" in e ? e.path : "param" in e ? (e as { param: string }).param : undefined,
      message: e.msg,
    }));
    const err: Error & { status?: number; details?: unknown[] } = new Error("Validation failed");
    err.status = 422;
    err.details = details;
    next(err);
    return;
  }
  next();
}
