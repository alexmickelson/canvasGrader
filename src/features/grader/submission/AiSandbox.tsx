import { type FC } from "react";
import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasModels";
import { SandboxView } from "../../sandbox/SandboxView";

export const AiSandbox: FC<{
  submission: CanvasSubmission;
  courseId: number;
  assignmentName: string;
  termName: string;
  courseName: string;
}> = () => {
  return <SandboxView />;
};
