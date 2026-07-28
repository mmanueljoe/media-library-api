import type { Request, Response, NextFunction } from "express";
import { connectDB } from "@/config/db.js";
import { logger } from "@/config/logger.js";
import { AppError } from "@/utils/AppError.js";

/**
 * Serverless has no boot step we can hang the DB connection off — the app is
 * imported and handed a request, that's it. So we connect on the way through
 * instead. connectDB() is cached and idempotent, so on a warm container this is
 * a readyState check and nothing more.
 */
export const ensureDbConnection = async (
    _req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        await connectDB();
        next();
    } catch (err: unknown) {
        logger.error({ err }, "database connection failed");
        next(new AppError("Database unavailable", 503));
    }
};
