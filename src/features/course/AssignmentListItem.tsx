import type { FC } from "react";
import { Link } from "react-router";
import type { CanvasAssignment } from "../../server/trpc/routers/canvas/canvasModels";
import { useAssignmentGradingStatus } from "./useAssignmentGradingStatus";

export const AssignmentListItem: FC<{
  assignment: CanvasAssignment;
  courseId: number;
}> = ({ assignment, courseId }) => {
  const { status } = useAssignmentGradingStatus(courseId, assignment.id, assignment.name);
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
        <SubmissionStatus assignment={assignment} courseId={courseId} />
      </div>
    </Link>
  );
};

const SubmissionStatus: FC<{
  assignment: CanvasAssignment;
  courseId: number;
}> = ({ assignment, courseId }) => {
  const { percentage, status } = useAssignmentGradingStatus(
    courseId,
    assignment.id,
    assignment.name
  );

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
