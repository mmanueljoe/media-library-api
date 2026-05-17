import { User, type UserDoc } from "../../src/models/user.js";
import { Media, type MediaDoc } from "../../src/models/media.js";

type UserOverrides = Partial<{
    email: string;
    password: string;
}>;

export const makeUser = async (overrides: UserOverrides = {}): Promise<UserDoc> => {
    const email = overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
    const password = overrides.password ?? "password123";

    // The User model has a pre("save") hook that hashes passwordHash.
    return User.create({ email, passwordHash: password });
};

type MediaOverrides = Partial<{
    ownerId: string;
    title: string;
    tags: string[];
    category: "image" | "document";
    url: string;
    publicId: string;
    originalName: string;
    mimeType: string;
    size: number;
}>;

export const makeMedia = async (
    ownerId: string,
    overrides: MediaOverrides = {}
): Promise<MediaDoc> => {
    return Media.create({
        ownerId,
        title: overrides.title ?? `Test media ${Date.now()}`,
        tags: overrides.tags ?? [],
        category: overrides.category ?? "image",
        url: overrides.url ?? "https://res.cloudinary.com/fake/media-library/test-asset",
        publicId: overrides.publicId ?? "media-library/test-asset",
        originalName: overrides.originalName ?? "test.png",
        mimeType: overrides.mimeType ?? "image/png",
        size: overrides.size ?? 1024,
    });
};
