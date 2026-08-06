import { AsyncResource } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "@/config/logger.js";
import { runWithRequestContext } from "@/config/requestContext.js";

const resolveRequestId = (req: Request): string => {
    const forwarded = req.headers["x-vercel-id"] ?? req.headers["x-request-id"];
    if (typeof forwarded === "string" && forwarded.length > 0) return forwarded;
    if (Array.isArray(forwarded) && forwarded[0]) return forwarded[0];
    return randomUUID();
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const requestId = resolveRequestId(req);
    const start = process.hrtime.bigint();

    res.setHeader("x-request-id", requestId);

    runWithRequestContext({ requestId }, () => {
        res.on(
            "finish",
            AsyncResource.bind(() => {
                const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
                logger.info(
                    {
                        requestId,
                        method: req.method,
                        path: req.originalUrl,
                        statusCode: res.statusCode,
                        durationMs: Number(durationMs.toFixed(2)),
                        userId: req.user?.id,
                    },
                    "request"
                );
            })
        );

        next();
    });
};
