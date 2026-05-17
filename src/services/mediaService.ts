import { unlink } from "node:fs/promises";

import { logger } from "../config/logger.js";
import { AppError } from "../utils/AppError.js";
import {
    createMedia as createMediaRepository,
    deleteMediaById as deleteMediaByIdRepository,
    findMediaById as findMediaByIdRepository,
    findMediaByOwner as findMediaByOwnerRepository,
    updateMediaById as updateMediaByIdRepository,
} from "../repositories/mediaRepository.js";

export const createMedia = async (input: {
    ownerId: string;
    title: string;
    tags?: string[];
    category: "image" | "document";
    filePath: string;
    originalName: string;
    mimeType: string;
    size: number;
}) => {
    const media = await createMediaRepository(input);

    logger.info(
        {
            mediaId: media._id.toString(),
            ownerId: input.ownerId,
            originalName: input.originalName,
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

    try {
        await unlink(media.filePath);
    } catch (err: unknown) {
        const error = err as { code?: string };
        if (error.code !== "ENOENT") {
            logger.warn({ err }, "Failed to delete media file from disk");
        }
    }

    await deleteMediaByIdRepository(mediaId);

    return { id: media._id.toString() };
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
