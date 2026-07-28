import { AppError } from "../utils/index.js";
import {
    createMedia as createMediaRepository,
    softDeleteMediaById as softDeleteMediaByIdRepository,
    restoreMediaById as restoreMediaByIdRepository,
    findMediaById as findMediaByIdRepository,
    findMediaByOwner as findMediaByOwnerRepository,
    updateMediaById as updateMediaByIdRepository,
    createAuditLog,
} from "../repositories/index.js";

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

    await createAuditLog({
        userId: input.ownerId,
        action: "create",
        resourceType: "Media",
        resourceId: media._id.toString(),
        metadata: { title: input.title, originalName: input.originalName },
    });

    return media;
};

export const createMultipleMedia = async (
    ownerId: string,
    files: Express.Multer.File[],
    meta: { title: string; tags?: string[]; category: "image" | "document" }
) => {
    const results = await Promise.all(
        files.map((file) =>
            createMediaRepository({
                ownerId,
                title: meta.title,
                tags: meta.tags ?? [],
                category: meta.category,
                filePath: file.path,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
            })
        )
    );

    const first = results[0];
    if (first) {
        await createAuditLog({
            userId: ownerId,
            action: "create",
            resourceType: "Media",
            resourceId: first._id.toString(),
            metadata: {
                title: meta.title,
                count: files.length,
                names: files.map((f) => f.originalname),
            },
        });
    }

    return results;
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

    const updated = await softDeleteMediaByIdRepository(mediaId);

    if (!updated) throw new AppError("Media not found", 404);

    await createAuditLog({
        userId: ownerId,
        action: "delete",
        resourceType: "Media",
        resourceId: mediaId,
        metadata: { title: media.title },
    });

    return { id: media._id.toString(), deletedAt: updated.deletedAt };
};

export const restoreMedia = async (ownerId: string, mediaId: string) => {
    const media = await findMediaByIdRepository(mediaId, true);

    if (!media) throw new AppError("Media not found", 404);

    if (media.ownerId.toString() !== ownerId) throw new AppError("Forbidden", 403);

    if (!media.deletedAt) throw new AppError("Media is not deleted", 400);

    const updated = await restoreMediaByIdRepository(mediaId);

    if (!updated) throw new AppError("Media not found", 404);

    await createAuditLog({
        userId: ownerId,
        action: "restore",
        resourceType: "Media",
        resourceId: mediaId,
        metadata: { title: media.title },
    });

    return updated;
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

    await createAuditLog({
        userId: ownerId,
        action: "update",
        resourceType: "Media",
        resourceId: mediaId,
        metadata: { changes: patch },
    });

    return updated;
};
