import type { Response, Request, NextFunction } from "express";
import { MulterError } from "multer";
import { AppError } from "../utils/index.js";
import { logger } from "../config/index.js";

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
            details: err.details,
        });
        return;
    }
    if (err instanceof MulterError) {
        logger.warn({ err }, "Upload error");
        res.status(400).json({
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
