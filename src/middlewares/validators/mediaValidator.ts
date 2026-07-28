import { z } from "zod";

/**
 * Tags arrive in three different shapes depending on the caller, so every
 * endpoint that accepts them needs the same normalising step:
 *
 * - `multipart/form-data` (upload) can't express an array at all — it sends the
 *   single string "one,two". This is what tripped up the upload endpoint.
 * - A query string sends "one,two" as well.
 * - JSON sends a real array, and repeated form fields do too — both pass straight
 *   through untouched.
 */
const tagsField = z.preprocess(
    (val) => {
        if (typeof val !== "string") return val;
        const parts = val
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        return parts.length ? parts : undefined;
    },
    z.array(z.string().trim().min(1)).optional()
);

export const createMediaSchema = {
    body: z.object({
        title: z.string().trim().min(1).max(255),
        tags: tagsField,
        /**
         * Optional because the server derives it from the uploaded file's type.
         * Still accepted so existing clients don't break — but if what you send
         * disagrees with the file, the upload is rejected rather than silently
         * corrected, so a mislabelling client finds out.
         */
        category: z.enum(["image", "document"]).optional(),
    }),
};

export const listMediaSchema = {
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(10),
        category: z.enum(["image", "document"]).optional(),
        tags: tagsField,
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

/**
 * No `category` here on purpose. It's derived from the file, and the file can't
 * change after upload — so letting a PATCH set it would reintroduce exactly the
 * mismatch that deriving it removes. Unknown keys are stripped by Zod, so an
 * existing client still sending it gets the rest of its update applied.
 */
export const updateMediaSchema = {
    params: getMediaByIdSchema.params,
    body: z
        .object({
            title: z.string().trim().min(1).max(255).optional(),
            tags: tagsField,
        })
        .refine((val) => Object.keys(val).length > 0, {
            message: "At least one field must be provided",
        }),
};
