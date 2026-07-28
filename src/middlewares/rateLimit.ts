import { MemoryStore, rateLimit, type Options } from "express-rate-limit";
import { env } from "@/config/env.js";
import { AppError } from "@/utils/AppError.js";

/**
 * Known limitation: the in-memory store keeps counters in one container. On
 * Vercel that means each warm container counts separately and every cold start
 * resets to zero, so an attacker spread across containers gets more attempts
 * than the numbers below suggest. Fixing it properly needs a shared store
 * (Upstash Redis is the usual pairing) — see the README. Until then this still
 * stops the naive case of one client hammering one endpoint, which is the attack
 * that actually shows up.
 *
 * The stores are built explicitly rather than left to the default so tests can
 * reset them between cases; a module-level counter shared by the whole suite
 * makes unrelated tests fail once someone adds the eleventh login case.
 */
const apiStore = new MemoryStore();
const authStore = new MemoryStore();

const windowMs = env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

const sharedOptions: Partial<Options> = {
    windowMs,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Routing the rejection through AppError keeps rate-limit responses in the
    // same envelope as every other error, so clients parse one shape.
    handler: (_req, _res, next) => {
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

/** Test-only. Clears every counter so cases can't leak state into each other. */
export const resetRateLimits = (): void => {
    apiStore.resetAll();
    authStore.resetAll();
};
