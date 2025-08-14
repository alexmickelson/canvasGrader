import { EventEmitter } from "events";
import compression from "compression";
import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./trpc/utils/main";
import cron from "node-cron";

cron.schedule("0 2 * * *", async () => {
  console.log("running a task every night at 2 am");
});

EventEmitter.defaultMaxListeners = 40;
const app = express();
app.use(compression());

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
    onError({ error, type, path, input }) {
      const hasPath = typeof path !== "undefined";
      const hasInput = typeof input !== "undefined";
      const errorMsg = `[tRPC:${type}]${
        hasPath ? ` "${String(path)}"` : ""
      } failed.${hasInput ? ` Input: ${JSON.stringify(input)}` : ""} Error: ${
        error.message
      }`;
      console.error(errorMsg);
      if (error.cause) {
        console.error(error.cause);
      }
      // Only re-throw if path and input are known
      if (hasPath && hasInput) {
        throw new Error(
          `${errorMsg}${error.cause ? `\nCause: ${error.cause}` : ""}`
        );
      }
    },
  })
);

const port = parseInt(process.env.PORT || "3000", 10);
app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
