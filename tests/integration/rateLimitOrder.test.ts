import { describe, it, expect, vi, beforeEach } from "vitest";

// No database in this file at all — that's the point. We want to prove the rate
// limiter rejects an attacker before anything tries to reach Mongo.
vi.mock("@/config/db.js", () => ({
    connectDB: vi.fn().mockRejectedValue(new Error("database is down")),
}));

const { resetRateLimits } = await import("@/middlewares/rateLimit.js");
const { api } = await import("../helpers/app.js");

describe("rate limiting runs before the database connection", () => {
    // .env.test sets AUTH_RATE_LIMIT_MAX_REQUESTS=5.
    const limit = 5;

    beforeEach(() => {
        resetRateLimits();
    });

    it("returns 429 rather than 503 once the budget is spent, even with Mongo down", async () => {
        const attempt = () =>
            api()
                .post("/api/v1/auth/login")
                .send({ email: "attacker@test.local", password: "guess" });

        // Every attempt up to the limit gets as far as the database and fails there.
        for (let i = 0; i < limit; i++) {
            const res = await attempt();
            expect(res.status).toBe(503);
        }

        // Past the limit, the limiter cuts in first — no connection attempt, so
        // an attacker can't tie up invocations waiting on connection timeouts.
        const blocked = await attempt();

        expect(blocked.status).toBe(429);
    });
});
