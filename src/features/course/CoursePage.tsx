import type { FC } from "react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useAssignmentsQuery } from "./canvasAssignmentHooks";
import { useAssignmentGroups } from "./useAssignmentGroups";
import { getAssignmentGradingStatus } from "./useAssignmentGradingStatus";
import type { CanvasAssignment } from "../../server/trpc/routers/canvas/canvasModels";
import { GitHubMappingPanelWithClassroomId } from "../../components/githubClassroomConfig/GitHubMappingPanelWithClassroomId";
import { CourseNameDisplay } from "../../components/CourseNameDisplay";
import { useUpdateSubmissionsMutation } from "../grader/graderHooks";
import { useQueries } from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";
import { Toggle } from "../../components/Toggle";
import { DisplayWeek } from "./DisplayWeek";

export const CoursePage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const parsedCourseId = courseId ? Number(courseId) : undefined;

  return (
    <div className="p-4 text-gray-200">
      <h2 className="unstyled text-2xl">
        Course{" "}
        {parsedCourseId && <CourseNameDisplay courseId={parsedCourseId} />}
      </h2>

      {parsedCourseId && <CourseAssignments courseId={parsedCourseId} />}
    </div>
  );
};

export const CourseAssignments: FC<{ courseId: number }> = ({ courseId }) => {
  const { data: assignments } = useAssignmentsQuery(courseId);
  const [filter, setFilter] = useState("");
  const [hideGraded, setHideGraded] = useState(true);

  const filtered = useMemo(() => {
    if (!assignments) return assignments;
    const q = filter.trim().toLowerCase();
    let result = assignments;
    if (q) {
      result = result.filter((a) => a.name.toLowerCase().includes(q));
    }
    // Sort by due date: earliest first, null/undefined due_at last
    return result.slice().sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });
  }, [assignments, filter]);

  const groups = useAssignmentGroups(filtered);

  return (
    <div className="mt-4">
      <GitHubMappingPanelWithClassroomId courseId={courseId} />

      <div className="mb-3 space-y-3">
        <div className="flex justify-end">
          <RefreshAllButton assignments={filtered || []} courseId={courseId} />
        </div>

        <div className="flex">
          <div className="flex-1">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter assignments..."
              className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>
          <div className="flex flex-col items-center">
            <Toggle
              label="Hide fully graded assignments"
              value={hideGraded}
              onChange={setHideGraded}
            />
          </div>
        </div>
      </div>

      <div className="">
        {groups.map((group) => (
          <DisplayWeek
            key={group.key}
            group={group}
            courseId={courseId}
            hideGraded={hideGraded}
            assignments={group.items}
          />
        ))}
      </div>
    </div>
  );
};

const RefreshAllButton: FC<{
  assignments: CanvasAssignment[];
  courseId: number;
}> = ({ assignments, courseId }) => {
  const updateSubmissionsMutation = useUpdateSubmissionsMutation();
  const trpc = useTRPC();

  // Fetch submission data for all assignments using useQueries
  const submissionQueries = useQueries({
    queries: assignments.map((assignment) => ({
      ...trpc.canvas.assignments.getAssignmentSubmissions.queryOptions({
        courseId,
        assignmentId: assignment.id,
        assignmentName: assignment.name,
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
        courseId,
        assignmentId: assignment.id,
        assignmentName: assignment.name,
      })
    );

    try {
      await Promise.all(refreshPromises);
    } catch (error) {
      console.error("Error refreshing assignments:", error);
    }
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
          Refresh Ungraded ({refreshableCount}/{assignments.length})
        </>
      )}
    </button>
  );
};
