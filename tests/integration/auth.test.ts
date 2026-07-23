import { describe, it, expect } from "vitest";
import { useTestDatabase } from "../setup/mongo.js";
import { api, authHeader, registerUser } from "../helpers/app.js";

useTestDatabase();

describe("POST /api/v1/auth/register", () => {
    it("creates a user and returns a token", async () => {
        const res = await api().post("/api/v1/auth/register").send({
            email: "alice@test.local",
            password: "password123",
        });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe("success");
        expect(res.body.data.user).toMatchObject({ email: "alice@test.local" });
        expect(typeof res.body.data.token).toBe("string");
    });

    it("rejects a duplicate email", async () => {
        await registerUser("bob@test.local");
        const res = await api()
            .post("/api/v1/auth/register")
            .send({ email: "bob@test.local", password: "password123" });

        expect(res.status).toBe(400);
        expect(res.body.status).toBe("error");
    });

    it("rejects a malformed body", async () => {
        const res = await api()
            .post("/api/v1/auth/register")
            .send({ email: "not-an-email", password: "short" });

        expect(res.status).toBe(400);
        expect(res.body.status).toBe("error");
        expect(Array.isArray(res.body.details)).toBe(true);
    });
});

describe("POST /api/v1/auth/login", () => {
    it("logs in a registered user", async () => {
        await registerUser("carol@test.local", "password123");

        const res = await api().post("/api/v1/auth/login").send({
            email: "carol@test.local",
            password: "password123",
        });

        expect(res.status).toBe(200);
        expect(res.body.data.user).toMatchObject({ email: "carol@test.local" });
        expect(typeof res.body.data.token).toBe("string");
    });

    it("rejects a wrong password", async () => {
        await registerUser("dave@test.local", "password123");

        const res = await api().post("/api/v1/auth/login").send({
            email: "dave@test.local",
            password: "wrong-password",
        });

        expect(res.status).toBe(401);
    });

    it("rejects an unknown email", async () => {
        const res = await api().post("/api/v1/auth/login").send({
            email: "nobody@test.local",
            password: "password123",
        });

        expect(res.status).toBe(401);
    });
});

describe("GET /api/v1/auth/me", () => {
    it("returns the current user when authenticated", async () => {
        const token = await registerUser("eve@test.local");
        const res = await api().get("/api/v1/auth/me").set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.data.user).toMatchObject({ email: "eve@test.local" });
    });

    it("rejects a missing token", async () => {
        const res = await api().get("/api/v1/auth/me");

        expect(res.status).toBe(401);
    });

    it("rejects a malformed token with 401", async () => {
        const res = await api().get("/api/v1/auth/me").set(authHeader("nonsense"));

        expect(res.status).toBe(401);
    });
});
