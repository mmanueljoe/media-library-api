import { Media, type MediaDoc } from "../models/index.js";
import { type CreateMediaInput } from "../types/types.js";

export const createMedia = async (data: CreateMediaInput): Promise<MediaDoc> => {
    return await Media.create(data);
};

export const findMediaByOwner = async (
    ownerId: string,
    page = 1,
    limit = 10,
    options?: {
        category?: "image" | "document";
        tags?: string[];
        search?: string;
        sortBy?: "createdAt" | "title";
        order?: "asc" | "desc";
        includeDeleted?: boolean;
    }
): Promise<{ total: number; results: MediaDoc[] }> => {
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { ownerId } as unknown as Record<string, unknown>;
    if (!options?.includeDeleted) filter.deletedAt = null;
    if (options?.category) filter.category = options.category;
    if (options?.tags?.length) filter.tags = { $in: options.tags };
    if (options?.search) filter.$text = { $search: options.search };

    const sortBy = options?.sortBy ?? "createdAt";
    const order = options?.order ?? "desc";
    const sort: Record<string, 1 | -1> = { [sortBy]: order === "asc" ? 1 : -1 };

    const [total, results] = await Promise.all([
        Media.countDocuments(filter),
        Media.find(filter).sort(sort).skip(skip).limit(limit),
    ]);

    return {
        total,
        results,
    };
};

export const findMediaById = async (
    id: string,
    includeDeleted = false
): Promise<MediaDoc | null> => {
    const filter: Record<string, unknown> = { _id: id };
    if (!includeDeleted) filter.deletedAt = null;
    return await Media.findOne(filter);
};

export const softDeleteMediaById = async (id: string): Promise<MediaDoc | null> => {
    return await Media.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true });
};

export const restoreMediaById = async (id: string): Promise<MediaDoc | null> => {
    return await Media.findByIdAndUpdate(id, { deletedAt: null }, { new: true });
};

export const updateMediaById = async (
    id: string,
    patch: Partial<Pick<CreateMediaInput, "title" | "tags" | "category">>
): Promise<MediaDoc | null> => {
    return await Media.findByIdAndUpdate(id, patch, {
        new: true,
        runValidators: true,
    });
};
