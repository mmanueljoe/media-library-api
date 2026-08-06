import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/utils/AppError.js";

/**
 * Cloudinary's callback receives a plain object, not an Error. This file replaces
 * the global mock (which always succeeds) with one that fails, so both halves of
 * the failure path get exercised: the client sees a 502, and the log keeps the
 * upstream detail. Without this the error path has no coverage at all.
 */
const cloudinaryError = {
    message: "File size too large",
    name: "Error",
    http_code: 400,
};

vi.mock("@/config/cloudinary.js", () => ({
    cloudinary: {
        uploader: {
            upload_stream: (_options: unknown, callback: (err: unknown) => void) => ({
                end: () => callback(cloudinaryError),
            }),
            destroy: vi.fn(),
        },
    },
    mimeToResourceType: () => "image",
}));

vi.mock("@/config/logger.js", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

vi.mock("@/repositories/mediaRepository.js", () => ({
    createMedia: vi.fn(),
    findMediaByOwner: vi.fn(),
    findMediaById: vi.fn(),
    softDeleteMediaById: vi.fn(),
    updateMediaById: vi.fn(),
    findDeletedMediaById: vi.fn(),
    restoreMediaById: vi.fn(),
    findMediaDeletedBefore: vi.fn(),
    hardDeleteMediaById: vi.fn(),
}));

const { logger } = await import("@/config/logger.js");
const { createMedia: createMediaRepository } = await import("@/repositories/mediaRepository.js");
const { createMedia } = await import("@/services/mediaService.js");

const realPng = () =>
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);

const upload = () =>
    createMedia({
        ownerId: "507f1f77bcf86cd799439011",
        title: "doomed",
        buffer: realPng(),
        originalName: "x.png",
        mimeType: "image/png",
        size: 16,
    });

describe("when Cloudinary rejects an upload", () => {
    beforeEach(() => {
        vi.mocked(logger.error).mockClear();
        vi.mocked(createMediaRepository).mockClear();
    });

    it("surfaces a 502, not an anonymous 500", async () => {
        // A storage-provider outage is upstream's fault. Left unmapped it reaches
        // the error handler as a plain Error and becomes a generic 500 logged as
        // "unhandled error", which says nothing about what broke.
        const err = await upload().catch((e: unknown) => e);

        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({ statusCode: 502 });
    });

    it("does not leak the provider's message to the client", async () => {
        const err = await upload().catch((e: unknown) => e);

        expect((err as AppError).message).not.toContain("File size too large");
    });

    it("logs the upstream failure as a real Error, so the stack survives", async () => {
        await upload().catch(() => undefined);

        expect(vi.mocked(logger.error)).toHaveBeenCalledTimes(1);
        const [context] = vi.mocked(logger.error).mock.calls[0] as [{ err: unknown }];

        // The SonarQube fix: reject with an Error rather than Cloudinary's plain
        // object, or this is false and the stack is gone.
        expect(context.err).toBeInstanceOf(Error);
        expect((context.err as Error).stack).toBeTruthy();
    });

    it("keeps the provider's message and status code in the log", async () => {
        await upload().catch(() => undefined);

        const [context] = vi.mocked(logger.error).mock.calls[0] as [{ err: Error }];

        expect(context.err.message).toContain("File size too large");
        expect(context.err.message).toContain("400");
        // Original response retained in full, in case the message isn't enough.
        expect(context.err.cause).toEqual(cloudinaryError);
    });

    it("logs enough context to identify the upload", async () => {
        await upload().catch(() => undefined);

        const [context] = vi.mocked(logger.error).mock.calls[0] as [Record<string, unknown>];

        expect(context).toMatchObject({
            ownerId: "507f1f77bcf86cd799439011",
            mimeType: "image/png",
            size: 16,
        });
    });

    it("never writes a database record for a failed upload", async () => {
        await upload().catch(() => undefined);

        expect(vi.mocked(createMediaRepository)).not.toHaveBeenCalled();
    });
});
