import app from "./app.js";
import { env, logger, connectDB } from "./config/index.js";
import mongoose from "mongoose";

const start = async (): Promise<void> => {
    await connectDB();

    const server = app.listen(env.PORT, () => {
        logger.info(`Server running on port ${env.PORT}`);
    });

    const shutdown = async (signal: string) => {
        logger.info(`${signal} received — shutting down gracefully`);
        server.close(async () => {
            await mongoose.disconnect();
            logger.info("Server stopped");
            process.exit(0);
        });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
};

process.on("unhandledRejection", (err: unknown) => {
    logger.fatal({ err }, "Unhandled rejection - shutting down");
    process.exit(1);
});

process.on("uncaughtException", (err: unknown) => {
    logger.fatal({ err }, "Uncaught exception - shutting down");
    process.exit(1);
});

await start();
