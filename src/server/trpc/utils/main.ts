import { canvasRouter } from "../routers/canvasRouter.js";
import { settingsRouter } from "../routers/settingsRouter.js";
import { createTRPCRouter } from "./trpc.js";

export const appRouter = createTRPCRouter({
  settings: settingsRouter,
  canvas: canvasRouter,
});

export type AppRouter = typeof appRouter;
