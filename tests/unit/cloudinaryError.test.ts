import { describe, it, expect, vi } from "vitest";

/**
 * Cloudinary's callback receives a plain object, not an Error. This file replaces
 * the global mock (which always succeeds) with one that fails, so the wrapping is
 * actually exercised — otherwise the error path has no coverage at all and a
 * regression to `reject(error)` would pass every test.
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

describe("a failed Cloudinary upload rejects with a real Error", () => {
    it("is an instance of Error, so downstream instanceof checks work", async () => {
        await expect(upload()).rejects.toBeInstanceOf(Error);
    });

    it("carries a stack trace", async () => {
        const err = await upload().catch((e: unknown) => e);

        expect((err as Error).stack).toBeTruthy();
    });

    it("keeps Cloudinary's message and status in the text", async () => {
        await expect(upload()).rejects.toThrow(/File size too large/);
        await expect(upload()).rejects.toThrow(/400/);
    });

    it("preserves the original response as cause, so nothing is lost", async () => {
        const err = await upload().catch((e: unknown) => e);

        expect((err as Error).cause).toEqual(cloudinaryError);
    });

    it("does not reach the repository when the upload fails", async () => {
        const { createMedia: createMediaRepository } =
            await import("@/repositories/mediaRepository.js");

        await upload().catch(() => undefined);

        expect(vi.mocked(createMediaRepository)).not.toHaveBeenCalled();
    });
});
