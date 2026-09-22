/**
 * Re-exports commonly needed Mongoose utility types.
 * Centralizes the workaround for mongoose v9's QueryFilter type not being
 * directly importable as a named export.
 */
import type mongoose from "mongoose";

/** Mongoose v9 query filter type — use this instead of FilterQuery. */
export type MongoFilter<T> = Parameters<typeof mongoose.sanitizeFilter<T>>[0];
