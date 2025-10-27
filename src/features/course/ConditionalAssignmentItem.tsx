import type { FC } from "react";
import type { CanvasAssignment } from "../../server/trpc/routers/canvas/canvasModels";
import { useSubmissionsQuery } from "../grader/graderHooks";
import { AssignmentListItem } from "./AssignmentListItem";
import { getAssignmentGradingStatus } from "./useAssignmentGradingStatus";

export const ConditionalAssignmentItem: FC<{
  assignment: CanvasAssignment;
  courseId: number;
  hideGraded: boolean;
}> = ({ assignment, courseId, hideGraded }) => {
  const { data: submissions, isLoading } = useSubmissionsQuery(
    courseId,
    assignment.id,
    assignment.name
  );

  const { status } = isLoading
    ? { status: "loading" as const }
    : getAssignmentGradingStatus(submissions);

  // If hideGraded is true and the assignment is graded, don't render it
  if (hideGraded && status === "graded") {
    console.log("hiding assignment", assignment.name, hideGraded, status);
    return null;
  }

  return <AssignmentListItem assignment={assignment} courseId={courseId} />;
};
