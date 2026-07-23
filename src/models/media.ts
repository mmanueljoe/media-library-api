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
        filePath: {
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
    },
    {
        timestamps: true,
    }
);

mediaSchema.index({ title: "text" });

export const Media = mongoose.model("Media", mediaSchema);

export type MediaSchema = mongoose.InferSchemaType<typeof mediaSchema>;

export type MediaDoc = mongoose.HydratedDocument<MediaSchema>;
