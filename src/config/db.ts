import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

export const connectDB = async (): Promise<void> => {
    await mongoose.connect(env.MONGO_URI);
    logger.info("Connected to MongoDB");
};
