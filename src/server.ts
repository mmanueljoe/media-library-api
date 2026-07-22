import app from "./app.js";
import { env, logger, connectDB } from "@/config/index.js";

const start = async (): Promise<void> => {
    await connectDB();

    app.listen(env.PORT, () => {
        logger.info({ port: env.PORT }, "server started");
    });
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
