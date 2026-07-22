import { describe, it, expect } from "vitest";
import { AppError } from "@/utils/AppError.js";

describe("AppError", () => {
    it("sets message and statusCode from the constructor", () => {
        const err = new AppError("Not found", 404);

        expect(err.message).toBe("Not found");
        expect(err.statusCode).toBe(404);
    });

    it("flags itself as operational", () => {
        const err = new AppError("Bad request", 400);

        expect(err.isOperational).toBe(true);
    });

    it("attaches details when provided", () => {
        const details = [{ field: "title", message: "Required" }];
        const err = new AppError("Validation failed", 400, details);

        expect(err.details).toEqual(details);
    });

    it("omits details when not provided", () => {
        const err = new AppError("Forbidden", 403);

        expect(err.details).toBeUndefined();
    });

    it("is an instance of Error and AppError", () => {
        const err = new AppError("Server error", 500);

        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(AppError);
    });

    it("captures a stack trace", () => {
        const err = new AppError("oops", 500);

        expect(err.stack).toBeTypeOf("string");
        expect(err.stack).toContain("AppError");
    });
});
