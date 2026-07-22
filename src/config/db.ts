import mongoose from "mongoose";
import { env, logger } from "@/config/index.js";

export const connectDB = async (): Promise<void> => {
    await mongoose.connect(env.DATABASE_URL);
    logger.info("Connected to MongoDB");
};
