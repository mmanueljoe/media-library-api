import type { Request, Response } from "express";
import { catchAsync } from "@/utils/catchAsync.js";
import {
    createMedia,
    deleteMedia as deleteMediaService,
    getMediaById as getMediaByIdService,
    updateMedia as updateMediaService,
    getMyMedia as getMyMediaService,
    restoreMedia as restoreMediaService,
    purgeDeletedMedia as purgeDeletedMediaService,
} from "@/services/mediaService.js";
import { env } from "@/config/env.js";
import { sendSuccess } from "@/utils/response.js";
import { AppError } from "@/utils/AppError.js";

export const uploadMedia = catchAsync(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;

    if (!req.file) throw new AppError("File is required", 400);

    const { title, tags, category } = req.body;
    const buffer = req.file!.buffer;
    const originalName = req.file!.originalname;
    const mimeType = req.file!.mimetype;
    const size = req.file!.size;

    const media = await createMedia({
        ownerId,
        title,
        tags,
        declaredCategory: category,
        buffer,
        originalName,
        mimeType,
        size,
    });

    sendSuccess(res, media, 201);
});

export const getMyMedia = catchAsync(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const { page, limit, category, tags, search, sortBy, order } = req.query as unknown as {
        page: number;
        limit: number;
        category?: "image" | "document";
        tags?: string[];
        search?: string;
        sortBy?: "createdAt" | "title";
        order?: "asc" | "desc";
    };

    const query: {
        page: number;
        limit: number;
        category?: "image" | "document";
        tags?: string[];
        search?: string;
        sortBy?: "createdAt" | "title";
        order?: "asc" | "desc";
    } = { page, limit };
    if (category !== undefined) query.category = category;
    if (tags !== undefined) query.tags = tags;
    if (search !== undefined) query.search = search;
    if (sortBy !== undefined) query.sortBy = sortBy;
    if (order !== undefined) query.order = order;

    const media = await getMyMediaService(ownerId, query);

    sendSuccess(res, media);
});

export const getMediaById = catchAsync(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) throw new AppError("Validation error", 400);

    const media = await getMediaByIdService(ownerId, id);

    sendSuccess(res, media);
});

export const deleteMedia = catchAsync(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) throw new AppError("Validation error", 400);

    const result = await deleteMediaService(ownerId, id);

    sendSuccess(res, result, 200);
});

export const updateMedia = catchAsync(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) throw new AppError("Validation error", 400);

    // No category: it's derived from the file at upload and the file never changes.
    const { title, tags } = req.body as {
        title?: string;
        tags?: string[];
    };

    const patch: { title?: string; tags?: string[] } = {};
    if (title !== undefined) patch.title = title;
    if (tags !== undefined) patch.tags = tags;

    const updated = await updateMediaService(ownerId, id, patch);

    sendSuccess(res, updated, 200);
});

export const restoreMedia = catchAsync(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) throw new AppError("Validation error", 400);

    const restored = await restoreMediaService(ownerId, id);

    sendSuccess(res, restored, 200);
});

/**
 * Triggered by Vercel Cron, not by users — see authenticateCron on the route.
 * Returns the counts so the run's outcome is visible in Vercel's cron log
 * without having to go digging through application logs.
 */
export const purgeDeletedMedia = catchAsync(async (_req: Request, res: Response) => {
    const result = await purgeDeletedMediaService({
        retentionDays: env.MEDIA_RETENTION_DAYS,
        batchLimit: env.MEDIA_PURGE_BATCH_LIMIT,
    });

    sendSuccess(res, result, 200);
});
