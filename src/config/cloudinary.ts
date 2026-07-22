import { v2 as cloudinary } from "cloudinary";
import { env } from "@/config/env.js";

cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
});

export { cloudinary };

export type CloudinaryResourceType = "image" | "raw";

export const mimeToResourceType = (mimeType: string): CloudinaryResourceType => {
    return mimeType === "application/pdf" ? "raw" : "image";
};
