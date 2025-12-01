import type { FC } from "react";
import { Expandable } from "../../../utils/Expandable";
import ExpandIcon from "../../../utils/ExpandIcon";
import { ConditionalAssignmentItem } from "./ConditionalAssignmentItem";
import type { useAssignmentGroups } from "./useAssignmentGroups";
import type { CanvasAssignment } from "../../../server/trpc/routers/canvas/canvasModels";
import { useSubmissionsQueries } from "../../grader/graderHooks";
import { getAssignmentGradingStatus } from "./useAssignmentGradingStatus";

export const DisplayWeek: FC<{
  group: ReturnType<typeof useAssignmentGroups>[number];
  hideGraded: boolean;
  assignments: CanvasAssignment[];
}> = ({ group, hideGraded, assignments }) => {
  const submissionsQueries = useSubmissionsQueries(assignments);

  const allStatuses = group.items.map((_, index) => {
    const query = submissionsQueries[index];
    if (!query.data || query.isLoading || query.isError) {
      return null;
    }
    const { status } = getAssignmentGradingStatus(query.data);
    return status;
  });

  const allGraded = allStatuses.every((status) => status === "graded");

  if (hideGraded && allGraded) {
    return <></>;
  }

  const headerLabel = group.weekStart
    ? new Date(group.weekStart).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    : "No due date";

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
        {group.items.map((assignment) => (
          <ConditionalAssignmentItem
            key={assignment.id}
            assignment={assignment}
            hideGraded={!!hideGraded}
          />
        ))}
      </div>
    </Expandable>
  );
};
