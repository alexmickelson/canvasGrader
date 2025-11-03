import type { FC } from "react";
import { Link } from "react-router";
import type { CanvasAssignment } from "../../server/trpc/routers/canvas/canvasModels";
import { getAssignmentGradingStatus } from "./useAssignmentGradingStatus";
import {
  useUpdateSubmissionsMutation,
  useSubmissionsQuery,
} from "../grader/graderHooks";
import { useCurrentCourse } from "../../components/contexts/CourseProvider";

export const AssignmentListItem: FC<{
  assignment: CanvasAssignment;
  termName: string;
}> = ({ assignment, termName }) => {
  const { courseId } = useCurrentCourse();
  const fmt = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "No due date";

  return (
    <Link
      to={`/course/${courseId}/assignment/${assignment.id}`}
      className={`
        block p-4 bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700 rounded-lg transition-colors
        w-96
      `}
    >
      <div className="flex flex-col gap-3">
        <div className="font-medium text-gray-100 text-lg">
          {assignment.name}
        </div>
        <div className="text-sm text-gray-400">{fmt(assignment.due_at)}</div>
        <div className="flex justify-between items-center gap-2">
          <SubmissionStatus
            assignment={assignment}
            termName={termName}
          />
          <RefreshButton
            assignment={assignment}
            termName={termName}
          />
        </div>
      </div>
    </Link>
  );
};

const SubmissionStatus: FC<{
  assignment: CanvasAssignment;
  termName: string;
}> = ({ assignment, termName }) => {

  const { courseId, courseName } = useCurrentCourse();
  const { data: submissions, isLoading } = useSubmissionsQuery({
    courseId,
    assignmentId: assignment.id,
    assignmentName: assignment.name,
    courseName,
    termName,
  });

  const { percentage, status } = isLoading
    ? { percentage: 0, status: "loading" as const }
    : getAssignmentGradingStatus(submissions);

  const basePillClass = "inline-block px-3 py-1 text-xs rounded-full border";

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
  termName: string;
}> = ({ assignment, termName }) => {
  const updateSubmissionsMutation = useUpdateSubmissionsMutation();

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    updateSubmissionsMutation.mutate({
      assignmentId: assignment.id,
      assignmentName: assignment.name,
      termName,
    });
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={updateSubmissionsMutation.isPending}
      className={`
        unstyled
        bg-purple-950/50 border-purple-900 border rounded
        hover:bg-purple-800 disabled:opacity-50
        text-purple-400 hover:text-purple-200 
        disabled:cursor-not-allowed transition-colors 
        p-1 
        flex align-middle justify-between
      `}
      title="Refresh submissions"
    >
      <span className="">Refresh</span>
      {updateSubmissionsMutation.isPending ? (
        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"></div>
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
          className="my-auto ms-2 stroke-current"
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
