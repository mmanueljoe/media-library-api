import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDB } from "./config/db.js";

const start = async (): Promise<void> => {
  await connectDB();

  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
    console.log(`Server running on port ${env.PORT}`);
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

start();
