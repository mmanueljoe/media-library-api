import { z } from "zod";

export const createMediaSchema = {
    body: z.object({
        title: z.string().trim().min(1).max(255),
        tags: z.array(z.string().trim()).optional(),
        category: z.enum(["image", "document"]),
    }),
};

export const listMediaSchema = {
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(10),
        category: z.enum(["image", "document"]).optional(),
        tags: z.preprocess(
            (val) => {
                if (typeof val !== "string") return val;
                const parts = val
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                return parts.length ? parts : undefined;
            },
            z.array(z.string().min(1)).optional()
        ),
        search: z.string().trim().min(1).optional(),
        sortBy: z.enum(["createdAt", "title"]).default("createdAt"),
        order: z.enum(["asc", "desc"]).default("desc"),
    }),
};

export const getMediaByIdSchema = {
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/),
    }),
};

export const updateMediaSchema = {
    params: getMediaByIdSchema.params,
    body: z
        .object({
            title: z.string().trim().min(1).max(255).optional(),
            tags: z.array(z.string().trim()).optional(),
            category: z.enum(["image", "document"]).optional(),
        })
        .refine((val) => Object.keys(val).length > 0, {
            message: "At least one field must be provided",
        }),
};

export type CreateMediaInput = z.infer<(typeof createMediaSchema)["body"]>;
