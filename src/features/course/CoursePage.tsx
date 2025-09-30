import type { FC } from "react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useAssignmentsQuery } from "./canvasAssignmentHooks";
import { useAssignmentGroups } from "./useAssignmentGroups";
import { AssignmentListItem } from "./AssignmentListItem";
import { getAssignmentGradingStatus } from "./useAssignmentGradingStatus";
import type { CanvasAssignment } from "../../server/trpc/routers/canvas/canvasModels";
import { GitHubMappingPanelWithClassroomId } from "../../components/githubClassroomConfig/GitHubMappingPanelWithClassroomId";
import { CourseNameDisplay } from "../../components/CourseNameDisplay";
import {
  useUpdateSubmissionsMutation,
  useSubmissionsQuery,
} from "../grader/graderHooks";

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
            <label
              className="
              flex align-middle p-2 cursor-pointer
              text-gray-300
              hover:text-fuchsia-400
              transition-colors duration-200 ease-in-out
            "
            >
              <input
                type="checkbox"
                className="appearance-none peer"
                onChange={() => setHideGraded((h) => !h)}
              />
              <span
                className={`
                  w-12 h-6 flex items-center flex-shrink-0 mx-3 p-1
                  bg-gray-600 rounded-full
                  duration-300 ease-in-out
                  peer-checked:bg-fuchsia-600
                  after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-md
                  after:duration-300 peer-checked:after:translate-x-6
                  group-hover:after:translate-x-1
                `}
              ></span>
              <span className="">Hide fully graded assignments</span>
            </label>
          </div>
        </div>
      </div>

      <div className="">
        {groups.map((group) => {
          // For the header label show the day of the first assignment in the group
          const headerLabel = group.weekStart
            ? new Date(group.weekStart).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })
            : "No due date";

          return (
            <div key={group.key}>
              <div className="p-2 text-sm text-gray-500 font-medium text-end border-b-2 border-slate-800">
                {headerLabel}
              </div>
              <div>
                {group.items.map((assignment) => (
                  <ConditionalAssignmentItem
                    key={assignment.id}
                    assignment={assignment}
                    courseId={courseId}
                    hideGraded={hideGraded}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ConditionalAssignmentItem: FC<{
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
    return null;
  }

  return <AssignmentListItem assignment={assignment} courseId={courseId} />;
};

const RefreshAllButton: FC<{
  assignments: CanvasAssignment[];
  courseId: number;
}> = ({ assignments, courseId }) => {
  const updateSubmissionsMutation = useUpdateSubmissionsMutation();

  const handleRefreshAll = async () => {
    // Call mutation for each assignment concurrently
    const refreshPromises = assignments.map((assignment) =>
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

  const refreshableCount = assignments.length;

  return (
    <button
      onClick={handleRefreshAll}
      disabled={updateSubmissionsMutation.isPending || refreshableCount === 0}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white font-medium transition-colors flex items-center gap-2"
      title={`Refresh submissions for ${refreshableCount} assignments`}
    >
      {updateSubmissionsMutation.isPending ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          Refreshing...
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
          Refresh All ({refreshableCount})
        </>
      )}
    </button>
  );
};
