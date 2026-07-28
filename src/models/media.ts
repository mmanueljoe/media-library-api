import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        tags: {
            type: [String],
            required: false,
            default: [],
        },
        category: {
            type: String,
            required: true,
            enum: ["image", "document"],
        },
        url: {
            type: String,
            required: true,
        },
        publicId: {
            type: String,
            required: true,
        },
        originalName: {
            type: String,
            required: true,
        },
        mimeType: {
            type: String,
            required: true,
        },
        size: {
            type: Number,
            required: true,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

mediaSchema.index({ title: "text" });

mediaSchema.index({ ownerId: 1, deletedAt: 1, createdAt: -1 });

export const Media = mongoose.model("Media", mediaSchema);

export type MediaSchema = mongoose.InferSchemaType<typeof mediaSchema>;

export type MediaDoc = mongoose.HydratedDocument<MediaSchema>;
