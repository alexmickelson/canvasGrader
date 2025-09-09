import { canvasRouter } from "../routers/canvas/canvasRouter.js";
import { settingsRouter } from "../routers/settingsRouter.js";
import { rubricAiReportRouter } from "../routers/rubricAI/rubricAiReportRouter.js";
import { fileViewerRouter } from "../routers/fileViewerRouter.js";
import { createTRPCRouter } from "./trpc.js";

export const appRouter = createTRPCRouter({
  settings: settingsRouter,
  canvas: canvasRouter,
  rubricAiReport: rubricAiReportRouter,
  fileViewer: fileViewerRouter,
});

export type AppRouter = typeof appRouter;
