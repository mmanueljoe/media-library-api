import type { UploadApiOptions, UploadApiResponse } from "cloudinary";

import { logger } from "@/config/logger.js";
import { cloudinary, mimeToResourceType } from "@/config/cloudinary.js";
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

const uploadBufferToCloudinary = (
    buffer: Buffer,
    options: UploadApiOptions
): Promise<UploadApiResponse> => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
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
    category: "image" | "document";
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
}) => {
    const resourceType = mimeToResourceType(input.mimeType);

    const uploadResult = await uploadBufferToCloudinary(input.buffer, {
        folder: CLOUDINARY_FOLDER,
        resource_type: resourceType,
    });

    const createInput: Parameters<typeof createMediaRepository>[0] = {
        ownerId: input.ownerId,
        title: input.title,
        category: input.category,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.size,
    };
    if (input.tags !== undefined) createInput.tags = input.tags;

    const media = await createMediaRepository(createInput);

    logger.info(
        {
            mediaId: media._id.toString(),
            ownerId: input.ownerId,
            publicId: media.publicId,
            mimeType: input.mimeType,
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

export const getMediaById = async (ownerId: string, mediaId: string) => {
    const media = await findMediaByIdRepository(mediaId);

    if (!media) throw new AppError("Media not found", 404);

    if (media.ownerId.toString() !== ownerId) throw new AppError("Forbidden", 403);

    return media;
};

export const deleteMedia = async (ownerId: string, mediaId: string) => {
    const media = await findMediaByIdRepository(mediaId);

    if (!media) throw new AppError("Media not found", 404);

    if (media.ownerId.toString() !== ownerId) throw new AppError("Forbidden", 403);

    const deleted = await softDeleteMediaByIdRepository(mediaId);

    if (!deleted) throw new AppError("Media not found", 404);

    logger.info(
        { mediaId: media._id.toString(), ownerId, publicId: media.publicId },
        "media soft deleted"
    );

    return { id: media._id.toString() };
};

export const restoreMedia = async (ownerId: string, mediaId: string) => {
    const media = await findDeletedMediaByIdRepository(mediaId);

    if (!media) throw new AppError("Deleted media not found", 404);

    if (media.ownerId.toString() !== ownerId) throw new AppError("Forbidden", 403);

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
    patch: { title?: string; tags?: string[]; category?: "image" | "document" }
) => {
    const media = await findMediaByIdRepository(mediaId);

    if (!media) throw new AppError("Media not found", 404);

    if (media.ownerId.toString() !== ownerId) throw new AppError("Forbidden", 403);

    const updated = await updateMediaByIdRepository(mediaId, patch);

    if (!updated) throw new AppError("Media not found", 404);

    return updated;
};
