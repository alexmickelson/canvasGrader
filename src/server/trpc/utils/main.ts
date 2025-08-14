import { createTRPCRouter } from "./trpc.js";

export const appRouter = createTRPCRouter({});

export type AppRouter = typeof appRouter;
