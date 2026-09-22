import type { Response } from "express";
import type { ApiResponse } from "../types";

export const responseUtil = {
  success<T>(res: Response, data?: T, message?: string, statusCode = 200): void {
    const body: ApiResponse<T> = { success: true };
    if (message) body.message = message;
    if (data !== undefined) body.data = data;
    res.status(statusCode).json(body);
  },

  created<T>(res: Response, data?: T, message = "Created successfully"): void {
    this.success(res, data, message, 201);
  },
};
