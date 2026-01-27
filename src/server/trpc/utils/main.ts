import { courseRouter } from "../routers/canvas/course/courseRouter.js";
import { settingsRouter } from "../routers/settingsRouter.js";
import { rubricAiReportRouter } from "../routers/rubricAI/rubricAiReportRouter.js";
import { fileViewerRouter } from "../routers/fileViewerRouter.js";
import { aiQueueRouter } from "../routers/aiQueueRouter.js";
import { sandboxRouter } from "../routers/sandbox/sandboxRouter.js";
import { githubClassroomRouter } from "../routers/github/githubClassroomRouter.js";
import { attachmentsRouter } from "../routers/canvas/attachmentsRouter.js";
import { assignmentsRouter } from "../routers/canvas/course/assignment/assignmentsRouter.js";
import { createTRPCRouter } from "./trpc.js";
import { generalAiRouter } from "../routers/generalAi/generalAiRouter.js";

export const appRouter = createTRPCRouter({
  settings: settingsRouter,
  canvas: {
    course: courseRouter,
    attachments: attachmentsRouter,
    assignments: assignmentsRouter,
  },
  generalAi: generalAiRouter,
  rubricAiReport: rubricAiReportRouter,
  fileViewer: fileViewerRouter,
  aiQueue: aiQueueRouter,
  sandbox: sandboxRouter,
  githubClassroom: githubClassroomRouter,
});

export type AppRouter = typeof appRouter;
