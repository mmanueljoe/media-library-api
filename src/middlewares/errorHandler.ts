import type { Response, Request, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";
import { logger } from "../config/logger.js";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError && err.isOperational) {
    logger.warn({ err }, "Operational error");
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
};
