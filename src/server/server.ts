import { EventEmitter } from "events";
import compression from "compression";
import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import path from "path";
import { appRouter } from "./trpc/utils/main.js";
import cron from "node-cron";
import dotenv from "dotenv";
import { execSync } from "child_process";
dotenv.config();

cron.schedule("0 2 * * *", async () => {
  console.log("running a task every night at 2 am");
});

// Check GitHub CLI authentication and login if needed
// async function checkGitHubAuth(): Promise<void> {
//   try {
//     // Check authentication status
//     execSync("gh auth status", { stdio: "ignore" });
//     console.log("✓ GitHub CLI is authenticated");
//   } catch {
//     console.log("⚠️  GitHub CLI not authenticated");
//     console.log("Starting GitHub CLI authentication process to enable github classroom downloads");

//     return new Promise((resolve, reject) => {
//       const authProcess = spawn("gh", ["auth", "login"], {
//         stdio: "inherit", // Allow user interaction
//       });

//       authProcess.on("close", (code) => {
//         if (code === 0) {
//           console.log("✓ GitHub authentication completed");
//           resolve();
//         } else {
//           console.log("❌ GitHub authentication failed");
//           reject(new Error("GitHub authentication failed"));
//         }
//       });

//       authProcess.on("error", (error) => {
//         console.log("❌ Error running gh auth login:", error.message);
//         reject(error);
//       });
//     });
//   }
// }

EventEmitter.defaultMaxListeners = 40;
const app = express();
app.use(compression());

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
    onError: (opts) => {
      const { error, type, path, input } = opts;
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

// Serve built frontend from dist in production
const distPath =
  process.env.CANVAS_GRADER_DIST_PATH || path.resolve(process.cwd(), "dist");
app.use(express.static(distPath));
// SPA fallback to index.html for non-API routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const port = parseInt(process.env.PORT || "3334", 10);

function setupGhCli() {
  try {
    console.log("Setting up git authentication with gh...");
    execSync("gh auth setup-git", { stdio: "inherit" });
    console.log("✓ Git authentication configured");
  } catch {
    console.log(
      "Warning: Failed to setup git authentication, some features may not work"
    );
  }
}

async function startServer() {
  setupGhCli();

  app.listen(port, () => {
    console.log(`Express server listening on http://localhost:${port}`);
  });
}

startServer();
