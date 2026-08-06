import type { Request, Response, NextFunction } from "express";
import { env } from "@/config/env.js";
import { logger } from "@/config/logger.js";
import { AppError } from "@/utils/AppError.js";

export const authenticateCron = (req: Request, _res: Response, next: NextFunction): void => {
    if (!env.CRON_SECRET) {
        logger.error("cron endpoint called but CRON_SECRET is not configured");
        return next(new AppError("Unauthorized", 401));
    }

    if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
        logger.warn({ ip: req.ip, path: req.originalUrl }, "cron authentication failed");
        return next(new AppError("Unauthorized", 401));
    }

    next();
};
