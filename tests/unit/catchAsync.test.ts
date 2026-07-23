import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "../../src/utils/catchAsync.js";

const makeReqResNext = () => {
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;
    return { req, res, next };
};

describe("catchAsync", () => {
    it("does not call next when the wrapped function resolves", async () => {
        const { req, res, next } = makeReqResNext();
        const handler = catchAsync(async () => {
            // resolves with undefined
        });

        handler(req, res, next);
        await new Promise((resolve) => setImmediate(resolve));

        expect(next).not.toHaveBeenCalled();
    });

    it("passes the rejection to next when the wrapped function rejects", async () => {
        const { req, res, next } = makeReqResNext();
        const boom = new Error("kaboom");
        const handler = catchAsync(async () => {
            throw boom;
        });

        handler(req, res, next);
        await new Promise((resolve) => setImmediate(resolve));

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(boom);
    });

    it("catches a synchronous throw from inside an async function", async () => {
        const { req, res, next } = makeReqResNext();
        const boom = new Error("inside async throw");
        const handler = catchAsync(async () => {
            throw boom;
        });

        handler(req, res, next);
        await new Promise((resolve) => setImmediate(resolve));

        expect(next).toHaveBeenCalledWith(boom);
    });
});
