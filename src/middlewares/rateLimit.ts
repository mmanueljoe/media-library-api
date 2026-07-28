import { MemoryStore, rateLimit, type Options } from "express-rate-limit";
import { env } from "@/config/env.js";
import { logger } from "@/config/logger.js";
import { AppError } from "@/utils/AppError.js";

const apiStore = new MemoryStore();
const authStore = new MemoryStore();

const windowMs = env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

const sharedOptions: Partial<Options> = {
    windowMs,
    standardHeaders: "draft-8",
    legacyHeaders: false,

    handler: (req, _res, next) => {
        logger.warn({ ip: req.ip, path: req.originalUrl }, "rate limit exceeded");
        next(new AppError("Too many requests. Please try again later.", 429));
    },
};

export const apiRateLimit = rateLimit({
    ...sharedOptions,
    store: apiStore,
    limit: env.RATE_LIMIT_MAX_REQUESTS,
});

export const authRateLimit = rateLimit({
    ...sharedOptions,
    store: authStore,
    limit: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    // Only failed attempts count.
    skipSuccessfulRequests: true,
});

export const resetRateLimits = (): void => {
    apiStore.resetAll();
    authStore.resetAll();
};
