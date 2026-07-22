import type { Request, Response, NextFunction } from "express";
import { logger } from "@/config/logger.js";

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        logger.info(
            {
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Number(durationMs.toFixed(2)),
            },
            "request"
        );
    });

    next();
};
