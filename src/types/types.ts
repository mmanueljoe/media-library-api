export type CreateUserInput = {
    email: string;
    passwordHash: string;
};

export type CreateMediaInput = {
    ownerId: string;
    title: string;
    tags?: string[];
    category: "image" | "document";
    filePath: string;
    originalName: string;
    mimeType: string;
    size: number;
};
