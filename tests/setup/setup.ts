import { vi } from "vitest";

vi.mock("../../src/config/cloudinary.js", () => {
    type Callback = (
        error: Error | null,
        result?: { secure_url: string; public_id: string }
    ) => void;

    return {
        cloudinary: {
            uploader: {
                upload_stream: (
                    options: { folder?: string; resource_type?: string },
                    callback: Callback
                ) => {
                    const folder = options.folder ?? "media-library";
                    const id = `${folder}/test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    return {
                        end: (_buffer: Buffer) => {
                            callback(null, {
                                secure_url: `https://res.cloudinary.com/fake/${id}`,
                                public_id: id,
                            });
                        },
                    };
                },
                destroy: vi.fn().mockResolvedValue({ result: "ok" }),
            },
        },
        mimeToResourceType: (mimeType: string): "image" | "raw" =>
            mimeType === "application/pdf" ? "raw" : "image",
    };
});
