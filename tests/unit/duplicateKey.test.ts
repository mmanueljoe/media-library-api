import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError.js";
import { isDuplicateKeyError } from "@/utils/mongoErrors.js";

vi.mock("@/repositories/authRepository.js", () => ({
    createUser: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
}));

const { createUser, findUserByEmail } = await import("@/repositories/authRepository.js");
const { register } = await import("@/services/authService.js");
const { errorHandler } = await import("@/middlewares/errorHandler.js");

/** What the Mongo driver actually throws on a unique-index violation. */
const duplicateKeyError = () =>
    Object.assign(new Error("E11000 duplicate key error"), { code: 11000 });

describe("isDuplicateKeyError", () => {
    it("recognizes the driver's duplicate-key error", () => {
        expect(isDuplicateKeyError(duplicateKeyError())).toBe(true);
    });

    it("ignores unrelated errors", () => {
        expect(isDuplicateKeyError(new Error("something else"))).toBe(false);
        expect(isDuplicateKeyError({ code: 121 })).toBe(false);
        expect(isDuplicateKeyError(null)).toBe(false);
        expect(isDuplicateKeyError(undefined)).toBe(false);
        expect(isDuplicateKeyError("E11000")).toBe(false);
    });
});

describe("register — losing the duplicate-email race", () => {
    beforeEach(() => {
        vi.mocked(findUserByEmail).mockReset();
        vi.mocked(createUser).mockReset();
    });

    it("returns the same 400 as the pre-check when the unique index rejects the insert", async () => {
        // The race: the lookup finds nothing, then the insert loses to a
        // concurrent request that got there first.
        vi.mocked(findUserByEmail).mockResolvedValue(null);
        vi.mocked(createUser).mockRejectedValue(duplicateKeyError());

        await expect(register("racer@test.local", "password123")).rejects.toMatchObject({
            statusCode: 400,
            message: "User already exists",
        });
    });

    it("does not swallow unrelated insert failures", async () => {
        vi.mocked(findUserByEmail).mockResolvedValue(null);
        vi.mocked(createUser).mockRejectedValue(new Error("connection reset"));

        await expect(register("racer@test.local", "password123")).rejects.toThrow(
            "connection reset"
        );
    });
});

describe("errorHandler — duplicate key fallback", () => {
    const callErrorHandler = (err: unknown) => {
        const req = { method: "POST", originalUrl: "/api/v1/media" } as unknown as Request;
        const json = vi.fn();
        const res = { status: vi.fn().mockReturnValue({ json }) } as unknown as Response;
        errorHandler(err, req, res, vi.fn() as unknown as NextFunction);
        return { res, json };
    };

    it("maps an untranslated duplicate key error to 409 instead of 500", () => {
        const { res, json } = callErrorHandler(duplicateKeyError());

        expect(res.status).toHaveBeenCalledWith(409);
        expect(json).toHaveBeenCalledWith({
            status: "error",
            message: "Resource already exists",
        });
    });

    it("still returns 500 for genuinely unexpected errors", () => {
        const { res, json } = callErrorHandler(new Error("boom"));

        expect(res.status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith({
            status: "error",
            message: "Internal server error",
        });
    });

    it("leaves operational AppErrors alone", () => {
        const { res, json } = callErrorHandler(new AppError("Media not found", 404));

        expect(res.status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({
            status: "error",
            message: "Media not found",
            details: undefined,
        });
    });
});
