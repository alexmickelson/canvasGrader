import type { FC } from "react";
import { Link } from "react-router";
import type { CanvasAssignment } from "../../server/trpc/routers/canvas/canvasModels";
import { getAssignmentGradingStatus } from "./useAssignmentGradingStatus";
import {
  useUpdateSubmissionsMutation,
  useSubmissionsQuery,
} from "../grader/graderHooks";

export const AssignmentListItem: FC<{
  assignment: CanvasAssignment;
  courseId: number;
}> = ({ assignment, courseId }) => {
  const { data: submissions, isLoading } = useSubmissionsQuery(
    courseId,
    assignment.id,
    assignment.name
  );

  const { status } = isLoading
    ? { status: "loading" as const }
    : getAssignmentGradingStatus(submissions);
  const fmt = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "No due date";

  if (status === "graded") return <></>;
  return (
    <Link
      to={`/course/${courseId}/assignment/${assignment.id}`}
      className="p-3 hover:bg-gray-800/60 cursor-pointer rounded block"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="font-medium text-gray-100">{assignment.name}</div>
          <span className="ps-5 text-xs text-gray-400">
            {fmt(assignment.due_at)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SubmissionStatus assignment={assignment} courseId={courseId} />
          <RefreshButton assignment={assignment} courseId={courseId} />
        </div>
      </div>
    </Link>
  );
};

const SubmissionStatus: FC<{
  assignment: CanvasAssignment;
  courseId: number;
}> = ({ assignment, courseId }) => {
  const { data: submissions, isLoading } = useSubmissionsQuery(
    courseId,
    assignment.id,
    assignment.name
  );

  const { percentage, status } = isLoading
    ? { percentage: 0, status: "loading" as const }
    : getAssignmentGradingStatus(submissions);

  const basePillClass = "inline-block px-3 py-1 text-xs rounded-full border";

  if (status === "loading") {
    return (
      <div
        className={`${basePillClass} bg-gray-700 text-gray-300  border-gray-600`}
      >
        Loading...
      </div>
    );
  }

  if (status === "no-submissions") {
    return (
      <div
        className={`${basePillClass} bg-gray-700 text-gray-300 border-gray-600`}
      >
        No submissions
      </div>
    );
  }

  if (status === "ungraded") {
    return (
      <div
        className={`${basePillClass} bg-red-950 text-red-200 border-red-600`}
      >
        Ungraded
      </div>
    );
  } else if (status === "graded") {
    return (
      <div
        className={`${basePillClass} bg-emerald-950 text-green-200 border-green-600`}
      >
        Graded
      </div>
    );
  } else {
    return (
      <div
        className={`${basePillClass} bg-yellow-950 text-yellow-100 border-yellow-600`}
      >
        {percentage}% graded
      </div>
    );
  }
};

const RefreshButton: FC<{
  assignment: CanvasAssignment;
  courseId: number;
}> = ({ assignment, courseId }) => {
  const updateSubmissionsMutation = useUpdateSubmissionsMutation();

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation
    e.stopPropagation(); // Stop event bubbling

    updateSubmissionsMutation.mutate({
      courseId,
      assignmentId: assignment.id,
      assignmentName: assignment.name,
    });
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={updateSubmissionsMutation.isPending}
      className="p-1 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title="Refresh submissions"
    >
      {updateSubmissionsMutation.isPending ? (
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
      ) : (
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
          className="text-gray-400 hover:text-gray-200"
        >
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      )}
    </button>
  );
};
