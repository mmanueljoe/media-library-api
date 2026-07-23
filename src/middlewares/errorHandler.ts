import type { Response, Request, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";
import { logger } from "../config/logger.js";

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    if (err instanceof AppError && err.isOperational) {
        const context = {
            err,
            method: req.method,
            path: req.originalUrl,
            statusCode: err.statusCode,
        };

        if (err.statusCode === 404) {
            logger.warn(context, "resource not found");
        } else if (err.statusCode >= 400 && err.statusCode < 500) {
            logger.warn(context, "validation or client error");
        } else {
            logger.error(context, "operational server error");
        }

        res.status(err.statusCode).json({
            status: "error",
            message: err.message,
            details: err.details,
        });
        return;
    }

    logger.error({ err, method: req.method, path: req.originalUrl }, "unhandled error");
    res.status(500).json({
        status: "error",
        message: "Internal server error",
    });
};
