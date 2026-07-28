/**
 * Mongo signals a unique-index violation with code 11000. The driver's error
 * isn't a typed class we can instanceof against, so we duck-type it.
 */
export const isDuplicateKeyError = (err: unknown): boolean =>
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === 11000;
