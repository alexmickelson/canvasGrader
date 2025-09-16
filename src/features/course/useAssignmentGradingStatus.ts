import { useMemo } from "react";
import type { CanvasSubmission } from "../../server/trpc/routers/canvas/canvasModels";
import { useSubmissionsQuery } from "../grader/graderHooks";

export const useAssignmentGradingStatus = (
  courseId: number,
  assignmentId: number
) => {
  const { data: submissions, isLoading } = useSubmissionsQuery(
    courseId,
    assignmentId
  );

  const gradingStatus = useMemo(() => {
    if (isLoading) {
      return {
        isLoading: true,
        gradedCount: 0,
        totalCount: 0,
        percentage: 0,
        status: "loading" as const,
      };
    }

    if (!submissions || submissions.length === 0) {
      return {
        isLoading: false,
        gradedCount: 0,
        totalCount: 0,
        percentage: 0,
        status: "no-submissions" as const,
      };
    }

    // Check if submission is graded (has grade, score, or graded_at)
    const isGraded = (submission: CanvasSubmission) => {
      return (
        submission.grade !== null ||
        submission.score !== null ||
        submission.graded_at !== null
      );
    };

    const gradedCount = submissions.filter(isGraded).length;
    const totalCount = submissions.length;
    const percentage = Math.round((gradedCount / totalCount) * 100);

    let status: "ungraded" | "partial" | "graded";
    if (gradedCount === 0) {
      status = "ungraded";
    } else if (gradedCount === totalCount) {
      status = "graded";
    } else {
      status = "partial";
    }

    return {
      isLoading: false,
      gradedCount,
      totalCount,
      percentage,
      status,
    };
  }, [submissions, isLoading]);

  return gradingStatus;
};
