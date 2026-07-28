import type { Request, Response, NextFunction } from "express";
import { env } from "@/config/env.js";
import { logger } from "@/config/logger.js";
import { AppError } from "@/utils/AppError.js";

/**
 * Guards endpoints only Vercel Cron should reach. Vercel sends CRON_SECRET as a
 * Bearer token automatically when it fires a scheduled job.
 *
 * Fails closed when CRON_SECRET is unset: this endpoint hard-deletes rows and
 * destroys files, so an unconfigured deployment should refuse it rather than
 * leave it open. A cron that never runs is a recoverable mistake; a public
 * purge endpoint is not.
 */
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
