import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError.js";

vi.mock("@/config/db.js", () => ({ connectDB: vi.fn() }));

const { connectDB } = await import("@/config/db.js");
const { ensureDbConnection } = await import("@/middlewares/ensureDbConnection.js");

const run = async () => {
    const next = vi.fn() as unknown as NextFunction;
    await ensureDbConnection({} as Request, {} as Response, next);
    return next;
};

describe("ensureDbConnection", () => {
    beforeEach(() => {
        vi.mocked(connectDB).mockReset();
    });

    it("passes the request through once connected", async () => {
        vi.mocked(connectDB).mockResolvedValue(undefined as never);

        const next = await run();

        expect(next).toHaveBeenCalledWith();
    });

    it("turns a failed connection into a 503 rather than letting it crash the request", async () => {
        vi.mocked(connectDB).mockRejectedValue(new Error("no route to host"));

        const next = await run();

        expect(next).toHaveBeenCalledTimes(1);
        const [err] = vi.mocked(next).mock.calls[0] as [unknown];
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({ statusCode: 503, message: "Database unavailable" });
    });
});
