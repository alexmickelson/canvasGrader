import type { FC } from "react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useAssignmentsQuery } from "./canvasAssignmentHooks";
import { GitHubMappingPanelWithClassroomId } from "./githubClassroomConfig/GitHubMappingPanelWithClassroomId";
import { useAssignmentGroups } from "./useAssignmentGroups";
import { AssignmentListItem } from "./AssignmentListItem";
import { useAssignmentGradingStatus } from "./useAssignmentGradingStatus";
import type { CanvasAssignment } from "../../server/trpc/routers/canvas/canvasModels";

export const CoursePage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const parsedCourseId = courseId ? Number(courseId) : undefined;

  return (
    <div className="p-4 text-gray-200">
      <h1 className="text-xl font-semibold">Course Page</h1>
      <p className="mt-2 text-sm text-gray-400">
        courseId: {courseId ?? "(missing)"}
      </p>
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

      <div className="mb-3 space-y-3 flex">
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
  const { status } = useAssignmentGradingStatus(courseId, assignment.id);

  // If hideGraded is true and the assignment is graded, don't render it
  if (hideGraded && status === "graded") {
    return null;
  }

  return <AssignmentListItem assignment={assignment} courseId={courseId} />;
};
