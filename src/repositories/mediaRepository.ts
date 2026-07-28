import { Media, type MediaDoc } from "@/models/media.js";

type CreateMediaInput = {
    ownerId: string;
    title: string;
    tags?: string[];
    category: "image" | "document";
    url: string;
    publicId: string;
    originalName: string;
    mimeType: string;
    size: number;
};

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

    const filter: Record<string, unknown> = { ownerId, deletedAt: null } as unknown as Record<
        string,
        unknown
    >;
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
    return await Media.findOne({ _id: id, deletedAt: null });
};

export const softDeleteMediaById = async (id: string): Promise<MediaDoc | null> => {
    return await Media.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { deletedAt: new Date() },
        { returnDocument: "after" }
    );
};

export const updateMediaById = async (
    id: string,
    patch: Partial<Pick<CreateMediaInput, "title" | "tags">>
): Promise<MediaDoc | null> => {
    return await Media.findOneAndUpdate({ _id: id, deletedAt: null }, patch, {
        returnDocument: "after",
        runValidators: true,
    });
};

/**
 * The one read that deliberately ignores the deletedAt filter. Restore needs to
 * see the deleted document, and the ownership check needs it too — otherwise
 * restore couldn't tell "not yours" from "doesn't exist".
 */
export const findDeletedMediaById = async (id: string): Promise<MediaDoc | null> => {
    return await Media.findOne({ _id: id, deletedAt: { $ne: null } });
};

export const restoreMediaById = async (id: string): Promise<MediaDoc | null> => {
    return await Media.findOneAndUpdate(
        { _id: id, deletedAt: { $ne: null } },
        { deletedAt: null },
        { returnDocument: "after" }
    );
};

/**
 * Purge candidates: soft-deleted longer ago than the retention window. Capped
 * because the caller has to destroy a Cloudinary asset per row and a serverless
 * invocation has a wall clock to respect.
 */
export const findMediaDeletedBefore = async (cutoff: Date, limit: number): Promise<MediaDoc[]> => {
    return await Media.find({ deletedAt: { $ne: null, $lt: cutoff } })
        .sort({ deletedAt: 1 })
        .limit(limit);
};

export const hardDeleteMediaById = async (id: string): Promise<MediaDoc | null> => {
    return await Media.findByIdAndDelete(id);
};
