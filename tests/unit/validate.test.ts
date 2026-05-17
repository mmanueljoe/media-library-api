import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validate } from "../../src/middlewares/validate.js";
import { AppError } from "../../src/utils/AppError.js";

const callValidate = (
    schemas: Parameters<typeof validate>[0],
    overrides: Partial<{ body: unknown; params: unknown; query: unknown }>
) => {
    const req = {
        body: overrides.body ?? {},
        params: overrides.params ?? {},
        query: overrides.query ?? {},
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;
    validate(schemas)(req, res, next);
    return { req, next };
};

describe("validate middleware", () => {
    describe("body", () => {
        const schema = {
            body: z.object({
                title: z.string().min(1),
                count: z.coerce.number(),
            }),
        };

        it("calls next with no argument when the body is valid", () => {
            const { req, next } = callValidate(schema, {
                body: { title: "hello", count: "3" },
            });

            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
            // parsed values replace the raw body
            expect(req.body).toEqual({ title: "hello", count: 3 });
        });

        it("calls next with a 400 AppError when the body is invalid", () => {
            const { next } = callValidate(schema, {
                body: { title: "", count: "not-a-number" },
            });

            expect(next).toHaveBeenCalledTimes(1);
            const err = vi.mocked(next).mock.calls[0]![0] as unknown as AppError;
            expect(err).toBeInstanceOf(AppError);
            expect(err.statusCode).toBe(400);
            expect(err.message).toBe("Validation failed");
            expect(err.details).toBeDefined();
            expect(err.details!.length).toBeGreaterThan(0);
            // Field paths are prefixed with "body."
            for (const d of err.details!) {
                expect(d.field.startsWith("body.")).toBe(true);
            }
        });
    });

    describe("params", () => {
        const schema = {
            params: z.object({
                id: z.string().regex(/^[0-9a-fA-F]{24}$/),
            }),
        };

        it("passes a valid params object", () => {
            const { next } = callValidate(schema, {
                params: { id: "507f1f77bcf86cd799439011" },
            });

            expect(next).toHaveBeenCalledWith();
        });

        it("rejects an invalid params object with details prefixed 'params.'", () => {
            const { next } = callValidate(schema, {
                params: { id: "not-an-objectid" },
            });

            const err = vi.mocked(next).mock.calls[0]![0] as unknown as AppError;
            expect(err.statusCode).toBe(400);
            expect(err.details![0]!.field.startsWith("params.")).toBe(true);
        });
    });

    describe("query", () => {
        const schema = {
            query: z.object({
                page: z.coerce.number().int().min(1),
            }),
        };

        it("passes a valid query and coerces types", () => {
            const { req, next } = callValidate(schema, {
                query: { page: "2" },
            });

            expect(next).toHaveBeenCalledWith();
            expect(req.query).toMatchObject({ page: 2 });
        });

        it("rejects an invalid query with details prefixed 'query.'", () => {
            const { next } = callValidate(schema, {
                query: { page: "0" },
            });

            const err = vi.mocked(next).mock.calls[0]![0] as unknown as AppError;
            expect(err.statusCode).toBe(400);
            expect(err.details![0]!.field.startsWith("query.")).toBe(true);
        });
    });

    it("passes a non-Zod error straight through to next", () => {
        const boom = new Error("preprocess blew up");
        const schema = {
            body: z.preprocess(() => {
                throw boom;
            }, z.unknown()),
        };

        const { next } = callValidate(schema, { body: {} });

        expect(next).toHaveBeenCalledWith(boom);
    });
});
