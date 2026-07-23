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
    }
): Promise<{ total: number; results: MediaDoc[] }> => {
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { ownerId } as unknown as Record<string, unknown>;
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

export const findMediaById = async (id: string): Promise<MediaDoc | null> => {
    return await Media.findById(id);
};

export const deleteMediaById = async (id: string): Promise<MediaDoc | null> => {
    return await Media.findByIdAndDelete(id);
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
