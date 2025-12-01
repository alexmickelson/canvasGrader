import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentCourse } from "../../components/contexts/CourseProvider";
import { useTRPC } from "../../server/trpc/trpcClient";
import { useUpdateSubmissionsMutation } from "../grader/graderHooks";
import { getAssignmentGradingStatus } from "./weeks/useAssignmentGradingStatus";
import { useAssignmentsQuery } from "../../utils/canvas/canvasAssignmentHooks";

export const RefreshUngradedSubmissionsButton = () => {
  const { data: assignments } = useAssignmentsQuery();

  const { courseId, courseName, termName } = useCurrentCourse();
  const updateSubmissionsMutation = useUpdateSubmissionsMutation();
  const trpc = useTRPC();

  // Fetch submission data for all assignments using useQueries
  const submissionQueries = useQueries({
    queries: assignments.map((assignment) => ({
      ...trpc.canvas.assignments.getAssignmentSubmissions.queryOptions({
        courseId,
        assignmentId: assignment.id,
        assignmentName: assignment.name,
        courseName,
        termName,
      }),
    })),
  });

  const assignmentsToRefresh = useMemo(() => {
    return assignments.filter((_assignment, index) => {
      const query = submissionQueries[index];

      if (!query.data || query.isLoading || query.isError) {
        return true;
      }

      const { status } = getAssignmentGradingStatus(query.data);
      return status !== "graded";
    });
  }, [assignments, submissionQueries]);

  const handleRefreshAll = async () => {
    // Call mutation for each non-graded assignment concurrently
    const refreshPromises = assignmentsToRefresh.map((assignment) =>
      updateSubmissionsMutation.mutateAsync({
        assignmentId: assignment.id,
        assignmentName: assignment.name,
      })
    );
    await Promise.all(refreshPromises);
  };

  const refreshableCount = assignmentsToRefresh.length;
  const isLoadingSubmissions = submissionQueries.some(
    (query) => query.isLoading
  );

  return (
    <button
      onClick={handleRefreshAll}
      disabled={
        updateSubmissionsMutation.isPending ||
        refreshableCount === 0 ||
        isLoadingSubmissions
      }
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white font-medium transition-colors flex items-center gap-2"
      title={
        isLoadingSubmissions
          ? "Loading submission data..."
          : `Refresh submissions for ${refreshableCount} ungraded assignments (${
              assignments.length - refreshableCount
            } fully graded assignments will be skipped)`
      }
    >
      {updateSubmissionsMutation.isPending ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          Refreshing...
        </>
      ) : isLoadingSubmissions ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          Loading...
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          Refresh Ungraded Submissions ({refreshableCount}/{assignments.length})
        </>
      )}
    </button>
  );
};
