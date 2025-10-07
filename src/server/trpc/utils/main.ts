import { canvasRouter } from "../routers/canvas/canvasRouter.js";
import { settingsRouter } from "../routers/settingsRouter.js";
import { rubricAiReportRouter } from "../routers/rubricAI/rubricAiReportRouter.js";
import { fileViewerRouter } from "../routers/fileViewerRouter.js";
import { aiQueueRouter } from "../routers/aiQueueRouter.js";
import { sandboxRouter } from "../routers/sandboxRouter.js";
import { createTRPCRouter } from "./trpc.js";

export const appRouter = createTRPCRouter({
  settings: settingsRouter,
  canvas: canvasRouter,
  rubricAiReport: rubricAiReportRouter,
  fileViewer: fileViewerRouter,
  aiQueue: aiQueueRouter,
  sandbox: sandboxRouter,
});

export type AppRouter = typeof appRouter;
