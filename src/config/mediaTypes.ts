/**
 * The one place that says which file types we accept and what each one is.
 *
 * Previously the accepted-types list lived in upload.ts and the category was
 * whatever the client claimed, which is how a PDF could be stored as an "image".
 * Category is a property of the file, not a user choice, so it's derived from
 * this map instead of being asked for.
 */
export const SUPPORTED_MEDIA_TYPES = {
    "image/jpeg": "image",
    "image/png": "image",
    "application/pdf": "document",
} as const satisfies Record<string, "image" | "document">;

export type SupportedMimeType = keyof typeof SUPPORTED_MEDIA_TYPES;

export type MediaCategory = (typeof SUPPORTED_MEDIA_TYPES)[SupportedMimeType];

export const allowedMimeTypes = Object.keys(SUPPORTED_MEDIA_TYPES) as SupportedMimeType[];

const isSupported = (mimeType: string): mimeType is SupportedMimeType =>
    mimeType in SUPPORTED_MEDIA_TYPES;

/**
 * Returns undefined for anything unsupported rather than throwing, so the caller
 * decides what that means. In practice Multer's fileFilter has already rejected
 * unsupported types before this runs.
 */
export const deriveCategory = (mimeType: string): MediaCategory | undefined =>
    isSupported(mimeType) ? SUPPORTED_MEDIA_TYPES[mimeType] : undefined;
