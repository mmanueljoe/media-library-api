import { describe, it, expect } from "vitest";
import { useTestDatabase } from "../setup/mongo.js";
import { api, registerUser } from "../helpers/app.js";

useTestDatabase();

describe("security headers", () => {
    it("sets Helmet's defensive headers", async () => {
        const res = await api().get("/health");

        expect(res.headers["x-content-type-options"]).toBe("nosniff");
        expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
        expect(res.headers["strict-transport-security"]).toBeDefined();
    });

    it("does not advertise the framework", async () => {
        const res = await api().get("/health");

        expect(res.headers["x-powered-by"]).toBeUndefined();
    });
});

describe("CORS", () => {
    it("allows an origin on the allowlist", async () => {
        const res = await api().get("/health").set("Origin", "https://app.test.local");

        expect(res.headers["access-control-allow-origin"]).toBe("https://app.test.local");
    });

    it("does not echo an origin that is not on the allowlist", async () => {
        const res = await api().get("/health").set("Origin", "https://evil.example.com");

        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("leaves non-browser clients alone", async () => {
        // No Origin header at all — Postman, curl, server-to-server.
        const res = await api().get("/health");

        expect(res.status).toBeLessThan(500);
    });
});

describe("auth rate limiting", () => {
    // .env.test sets AUTH_RATE_LIMIT_MAX_REQUESTS=5.
    const limit = 5;

    it("blocks once the failed-attempt budget is spent", async () => {
        await registerUser("victim@test.local", "correct-password");

        const attempt = () =>
            api()
                .post("/api/v1/auth/login")
                .send({ email: "victim@test.local", password: "wrong-password" });

        for (let i = 0; i < limit; i++) {
            const res = await attempt();
            expect(res.status).toBe(401);
        }

        const blocked = await attempt();

        expect(blocked.status).toBe(429);
        expect(blocked.body).toMatchObject({
            status: "error",
            message: "Too many requests. Please try again later.",
        });
    });

    it("does not spend the budget on successful logins", async () => {
        await registerUser("frequent@test.local", "correct-password");

        for (let i = 0; i < limit + 2; i++) {
            const res = await api()
                .post("/api/v1/auth/login")
                .send({ email: "frequent@test.local", password: "correct-password" });
            expect(res.status).toBe(200);
        }
    });

    it("still allows a real login after failures that stayed under the limit", async () => {
        await registerUser("careless@test.local", "correct-password");

        for (let i = 0; i < limit - 1; i++) {
            await api()
                .post("/api/v1/auth/login")
                .send({ email: "careless@test.local", password: "wrong-password" });
        }

        const res = await api()
            .post("/api/v1/auth/login")
            .send({ email: "careless@test.local", password: "correct-password" });

        expect(res.status).toBe(200);
    });
});
