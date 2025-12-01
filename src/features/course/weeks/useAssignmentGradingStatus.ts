import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasModels";

export const getAssignmentGradingStatus = (submissions: CanvasSubmission[]) => {
  if (submissions.length === 0) {
    return {
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
    gradedCount,
    totalCount,
    percentage,
    status,
  };
};
