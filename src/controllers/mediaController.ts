import type { Request, Response } from "express";
import { catchAsync } from "@/utils/catchAsync.js";
import {
    createMedia,
    deleteMedia as deleteMediaService,
    getMediaById as getMediaByIdService,
    updateMedia as updateMediaService,
    getMyMedia as getMyMediaService,
} from "@/services/mediaService.js";
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
        category,
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

    const { title, tags, category } = req.body as {
        title?: string;
        tags?: string[];
        category?: "image" | "document";
    };

    const patch: { title?: string; tags?: string[]; category?: "image" | "document" } = {};
    if (title !== undefined) patch.title = title;
    if (tags !== undefined) patch.tags = tags;
    if (category !== undefined) patch.category = category;

    const updated = await updateMediaService(ownerId, id, patch);

    sendSuccess(res, updated, 200);
});
