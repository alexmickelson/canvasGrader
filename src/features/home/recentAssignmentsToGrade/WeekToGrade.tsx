import { type FC } from "react";
import type {
  CanvasAssignment,
  CanvasCourse,
} from "../../../server/trpc/routers/canvas/canvasModels";
import type { useAssignmentGroups } from "../../course/weeks/useAssignmentGroups";
import { useFullAssignmentDataQuery } from "../../../utils/canvas/canvasAssignmentHooks";
import { Expandable } from "../../../utils/Expandable";
import ExpandIcon from "../../../utils/ExpandIcon";
import { getAssignmentGradingStatus } from "../../course/weeks/useAssignmentGradingStatus";
import { Link } from "react-router";

export const WeekToGrade: FC<{
  group: ReturnType<typeof useAssignmentGroups>[number];
  hideGraded: boolean;
  assignments: CanvasAssignment[];
}> = ({ group, hideGraded, assignments }) => {
  const fullAssignmentDataQueries = useFullAssignmentDataQuery(assignments);
  const fullAssignmentsWithStatus = fullAssignmentDataQueries.flatMap((q) => ({
    ...q.data,
    statusInfo: getAssignmentGradingStatus(q.data.submissions),
  }));

  const headerLabel = group.weekStart
    ? new Date(group.weekStart).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    : "No due date";

  const allGraded = fullAssignmentsWithStatus.every(
    (fullAssignment) => fullAssignment.statusInfo.status === "graded"
  );

  if (hideGraded && allGraded) {
    return <></>;
  }
  return (
    <Expandable
      defaultExpanded={!allGraded}
      ExpandableElement={({ setIsExpanded, isExpanded }) => (
        <div
          className={`
                p-2 text-sm flex cursor-pointer group
                text-gray-500  transition-all hover:text-gray-200
                font-medium text-end 
                border-b-2 border-slate-800 
              `}
          role="button"
          onClick={() => setIsExpanded((e) => !e)}
        >
          <span className="transition-transform group-hover:scale-105 ">
            {headerLabel}
          </span>
          <ExpandIcon
            style={{
              ...(isExpanded ? { rotate: "-90deg" } : {}),
            }}
          />
        </div>
      )}
    >
      <div className="flex gap-4 flex-wrap p-4 pt-2">
        {fullAssignmentsWithStatus.map((fullAssignment) => (
          <LocalAssignmentListItem
            assignment={fullAssignment.assignment}
            hideGraded={hideGraded}
            statusInfo={fullAssignment.statusInfo}
            course={fullAssignment.course}
          />
        ))}
      </div>
    </Expandable>
  );
};

const LocalAssignmentListItem: FC<{
  assignment: CanvasAssignment;
  course: CanvasCourse;
  hideGraded: boolean;
  statusInfo: ReturnType<typeof getAssignmentGradingStatus>;
}> = ({ assignment, hideGraded, statusInfo, course }) => {
  const fmt = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
        })
      : "No due date";

  if (hideGraded && statusInfo.status === "graded") {
    return <></>;
  }
  return (
    <Link
      to={`/course/${assignment.course_id}/assignment/${assignment.id}`}
      className={`
          block p-4 bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700 rounded-lg transition-colors
          w-96
        `}
      draggable={false}
    >
      <div className="flex flex-col ">
        <div className="font-medium text-gray-100 text-lg">
          {assignment.name}
        </div>

        <div className="text-sm text-gray-400">{fmt(assignment.due_at)}</div>
        <div className="flex justify-between items-center gap-2">
          <div className="text-sm text-gray-400">{course.name}</div>
          <SubmissionStatus statusInfo={statusInfo} />
        </div>
      </div>
    </Link>
  );
};

const SubmissionStatus: FC<{
  statusInfo: ReturnType<typeof getAssignmentGradingStatus>;
}> = ({ statusInfo: { status, percentage } }) => {
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
        {percentage}% graded
      </div>
    );
  }
  if (status === "graded") {
    return (
      <div
        className={`${basePillClass} bg-emerald-950 text-green-200 border-green-600`}
      >
        Graded
      </div>
    );
  }
  return (
    <div
      className={`${basePillClass} bg-yellow-950 text-yellow-100 border-yellow-600`}
    >
      {percentage}% graded
    </div>
  );
};
