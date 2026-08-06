import { AsyncResource } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "@/config/logger.js";
import { runWithRequestContext } from "@/config/requestContext.js";

/**
 * Prefer an id the platform already assigned — Vercel stamps every request with
 * x-vercel-id, and reusing it lets our logs and Vercel's own function logs be
 * lined up for the same request. Only generate one when nothing upstream did.
 */
const resolveRequestId = (req: Request): string => {
    const forwarded = req.headers["x-vercel-id"] ?? req.headers["x-request-id"];
    if (typeof forwarded === "string" && forwarded.length > 0) return forwarded;
    if (Array.isArray(forwarded) && forwarded[0]) return forwarded[0];
    return randomUUID();
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const requestId = resolveRequestId(req);
    const start = process.hrtime.bigint();

    // Echoed back so a client reporting a problem can quote the id, and we can
    // find their exact request without guessing from timestamps.
    res.setHeader("x-request-id", requestId);

    runWithRequestContext({ requestId }, () => {
        /**
         * AsyncResource.bind is doing real work here. An event listener runs in
         * the async context of whoever calls emit(), not whoever registered it —
         * so when the platform finishes the response from its own context, the
         * AsyncLocalStorage store is empty and the logger's mixin has no
         * requestId to add. Binding captures the context at registration.
         *
         * requestId is also passed explicitly below: it's in scope, and the one
         * line that summarises every request shouldn't depend on context
         * plumbing surviving whatever the host does to the response.
         */
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
                        // Populated by `authenticate`, so it's only present on
                        // authenticated routes — which is where it's useful.
                        userId: req.user?.id,
                    },
                    "request"
                );
            })
        );

        next();
    });
};
