import { canvasRouter } from "../routers/canvas/canvasRouter.js";
import { settingsRouter } from "../routers/settingsRouter.js";
import { rubricAiReportRouter } from "../routers/rubricAiReportRouter.js";
import { createTRPCRouter } from "./trpc.js";

export const appRouter = createTRPCRouter({
  settings: settingsRouter,
  canvas: canvasRouter,
  rubricAiReport: rubricAiReportRouter,
});

export type AppRouter = typeof appRouter;
