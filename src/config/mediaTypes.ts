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

export const deriveCategory = (mimeType: string): MediaCategory | undefined =>
    isSupported(mimeType) ? SUPPORTED_MEDIA_TYPES[mimeType] : undefined;

const MAGIC_NUMBERS: ReadonlyArray<{ mimeType: SupportedMimeType; bytes: readonly number[] }> = [
    { mimeType: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },

    { mimeType: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },

    { mimeType: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

const startsWith = (buffer: Buffer, bytes: readonly number[]): boolean =>
    buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte);

export const sniffMimeType = (buffer: Buffer): SupportedMimeType | undefined =>
    MAGIC_NUMBERS.find(({ bytes }) => startsWith(buffer, bytes))?.mimeType;
