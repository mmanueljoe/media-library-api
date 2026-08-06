import type { UploadApiErrorResponse, UploadApiOptions, UploadApiResponse } from "cloudinary";

import { logger } from "@/config/logger.js";
import { cloudinary, mimeToResourceType } from "@/config/cloudinary.js";
import {
    allowedMimeTypes,
    deriveCategory,
    sniffMimeType,
    type MediaCategory,
} from "@/config/mediaTypes.js";
import { AppError } from "@/utils/AppError.js";
import {
    createMedia as createMediaRepository,
    softDeleteMediaById as softDeleteMediaByIdRepository,
    findMediaById as findMediaByIdRepository,
    findMediaByOwner as findMediaByOwnerRepository,
    updateMediaById as updateMediaByIdRepository,
    findDeletedMediaById as findDeletedMediaByIdRepository,
    restoreMediaById as restoreMediaByIdRepository,
    findMediaDeletedBefore as findMediaDeletedBeforeRepository,
    hardDeleteMediaById as hardDeleteMediaByIdRepository,
} from "@/repositories/mediaRepository.js";

const CLOUDINARY_FOLDER = "media-library";

/**
 * Cloudinary hands its callback an UploadApiErrorResponse — a plain object with
 * `message`, `name`, and `http_code`, not an Error. Rejecting with it directly
 * gives a rejection carrying no stack trace, and makes `err instanceof Error`
 * false everywhere downstream, which our error handler branches on. So we wrap
 * it, keeping the original as `cause` so nothing is lost.
 */
const toError = (error: UploadApiErrorResponse): Error =>
    new Error(`Cloudinary upload failed: ${error.message} (http ${error.http_code})`, {
        cause: error,
    });

const uploadBufferToCloudinary = (
    buffer: Buffer,
    options: UploadApiOptions
): Promise<UploadApiResponse> => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(toError(error));
            if (!result) return reject(new Error("Cloudinary returned no result"));
            resolve(result);
        });

        stream.end(buffer);
    });
};

export const createMedia = async (input: {
    ownerId: string;
    title: string;
    tags?: string[];
    declaredCategory?: MediaCategory;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
}) => {
    const actualMimeType = sniffMimeType(input.buffer);

    if (!actualMimeType) {
        throw new AppError(
            `File contents are not a supported type. Allowed: ${allowedMimeTypes.join(", ")}`,
            400
        );
    }

    if (actualMimeType !== input.mimeType) {
        throw new AppError(
            `File was sent as "${input.mimeType}" but its contents are "${actualMimeType}"`,
            400
        );
    }

    const category = deriveCategory(actualMimeType)!;

    if (input.declaredCategory && input.declaredCategory !== category) {
        throw new AppError(
            `Category "${input.declaredCategory}" does not match the uploaded file, which is a "${category}"`,
            400
        );
    }

    const resourceType = mimeToResourceType(actualMimeType);

    const uploadResult = await uploadBufferToCloudinary(input.buffer, {
        folder: CLOUDINARY_FOLDER,
        resource_type: resourceType,
    });

    const createInput: Parameters<typeof createMediaRepository>[0] = {
        ownerId: input.ownerId,
        title: input.title,
        category,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        originalName: input.originalName,
        mimeType: actualMimeType,
        size: input.size,
    };
    if (input.tags !== undefined) createInput.tags = input.tags;

    const media = await createMediaRepository(createInput);

    logger.info(
        {
            mediaId: media._id.toString(),
            ownerId: input.ownerId,
            publicId: media.publicId,
            mimeType: actualMimeType,
            category,
            size: input.size,
        },
        "file uploaded successfully"
    );

    return media;
};

export const getMyMedia = async (
    ownerId: string,
    query: {
        page: number;
        limit: number;
        category?: "image" | "document";
        tags?: string[];
        search?: string;
        sortBy?: "createdAt" | "title";
        order?: "asc" | "desc";
    }
) => {
    const options: {
        category?: "image" | "document";
        tags?: string[];
        search?: string;
        sortBy?: "createdAt" | "title";
        order?: "asc" | "desc";
    } = {};
    if (query.category !== undefined) options.category = query.category;
    if (query.tags !== undefined) options.tags = query.tags;
    if (query.search !== undefined) options.search = query.search;
    if (query.sortBy !== undefined) options.sortBy = query.sortBy;
    if (query.order !== undefined) options.order = query.order;

    const { total, results } = await findMediaByOwnerRepository(
        ownerId,
        query.page,
        query.limit,
        options
    );

    const totalPages = Math.ceil(total / query.limit);

    return {
        results,
        pagination: {
            total,
            page: query.page,
            limit: query.limit,
            totalPages,
        },
    };
};

const findOwnedMediaOrFail = async (ownerId: string, mediaId: string) => {
    const media = await findMediaByIdRepository(mediaId);

    if (media?.ownerId.toString() !== ownerId) {
        throw new AppError("Media not found", 404);
    }

    return media;
};

export const getMediaById = async (ownerId: string, mediaId: string) => {
    return await findOwnedMediaOrFail(ownerId, mediaId);
};

export const deleteMedia = async (ownerId: string, mediaId: string) => {
    const media = await findOwnedMediaOrFail(ownerId, mediaId);

    const deleted = await softDeleteMediaByIdRepository(mediaId);

    if (!deleted) throw new AppError("Media not found", 404);

    logger.info(
        { mediaId: media._id.toString(), ownerId, publicId: media.publicId },
        "media soft deleted"
    );

    return { id: media._id.toString() };
};

export const restoreMedia = async (ownerId: string, mediaId: string) => {
    // Same reasoning as findOwnedMediaOrFail, against the deleted set.
    const media = await findDeletedMediaByIdRepository(mediaId);

    if (media?.ownerId.toString() !== ownerId) {
        throw new AppError("Deleted media not found", 404);
    }

    const restored = await restoreMediaByIdRepository(mediaId);

    if (!restored) throw new AppError("Deleted media not found", 404);

    logger.info({ mediaId, ownerId, publicId: media.publicId }, "media restored");

    return restored;
};

export const purgeDeletedMedia = async (input: {
    retentionDays: number;
    batchLimit: number;
}): Promise<{ purged: number; failed: number; cutoff: string }> => {
    const cutoff = new Date(Date.now() - input.retentionDays * 24 * 60 * 60 * 1000);

    const candidates = await findMediaDeletedBeforeRepository(cutoff, input.batchLimit);

    let purged = 0;
    let failed = 0;

    for (const media of candidates) {
        try {
            await cloudinary.uploader.destroy(media.publicId, {
                resource_type: mimeToResourceType(media.mimeType),
            });

            await hardDeleteMediaByIdRepository(media._id.toString());
            purged++;
        } catch (err: unknown) {
            failed++;
            logger.error(
                { err, mediaId: media._id.toString(), publicId: media.publicId },
                "failed to purge media — will retry on the next run"
            );
        }
    }

    logger.info(
        {
            purged,
            failed,
            candidates: candidates.length,
            cutoff: cutoff.toISOString(),
            retentionDays: input.retentionDays,
        },
        "purge of soft-deleted media finished"
    );

    // A full batch means there's probably more waiting. Surfaced so it's visible
    // in the cron response and logs rather than silently taking days to drain.
    if (candidates.length === input.batchLimit) {
        logger.warn(
            { batchLimit: input.batchLimit },
            "purge hit its batch limit — more items are still pending"
        );
    }

    return { purged, failed, cutoff: cutoff.toISOString() };
};

export const updateMedia = async (
    ownerId: string,
    mediaId: string,
    patch: { title?: string; tags?: string[] }
) => {
    await findOwnedMediaOrFail(ownerId, mediaId);

    const updated = await updateMediaByIdRepository(mediaId, patch);

    if (!updated) throw new AppError("Media not found", 404);

    return updated;
};
