import type { FC } from "react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAssignmentsQuery } from "./canvasAssignmentHooks";
import { GitHubMappingPanelWithClassroomId } from "./githubClassroomConfig/GitHubMappingPanelWithClassroomId";

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
  const navigate = useNavigate();

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

  const fmt = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "No due date";

  // Group assignments by week. Assumption: week starts on Monday.
  type Assignment = NonNullable<typeof filtered>[number];

  const groups = useMemo(() => {
    if (!filtered)
      return [] as { key: string; weekStart?: Date; items: Assignment[] }[];

    const result: { key: string; weekStart?: Date; items: Assignment[] }[] = [];
    const map = new Map<
      string,
      { key: string; weekStart?: Date; items: Assignment[] }
    >();

    const getWeekKey = (iso?: string | null) => {
      if (!iso) return "__nodue";
      const d = new Date(iso);
      // Normalize to start of week (Monday)
      const day = (d.getDay() + 6) % 7; // Monday=0 .. Sunday=6
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - day);
      weekStart.setHours(0, 0, 0, 0);
      return weekStart.toISOString();
    };

    for (const a of filtered) {
      const key = getWeekKey(a.due_at);
      if (!map.has(key)) {
        map.set(key, {
          key,
          weekStart: key === "__nodue" ? undefined : new Date(key),
          items: [],
        });
      }
      map.get(key)!.items.push(a);
    }

    // Keep order consistent with filtered (which is already sorted)
    for (const a of filtered) {
      const key = getWeekKey(a.due_at);
      const g = map.get(key)!;
      if (!result.includes(g)) result.push(g);
    }

    return result;
  }, [filtered]);

  return (
    <div className="mt-4">
      <GitHubMappingPanelWithClassroomId courseId={courseId} />

      <div className="mb-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter assignments..."
          className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-700"
        />
      </div>

      <ul className="">
        {groups.map((group) => {
          // For the header label show the day of the first assignment in the group
          const headerLabel = group.weekStart
            ? new Date(group.weekStart).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })
            : "No due date";

          return (
            <li key={group.key}>
              <div className="p-2 text-sm text-gray-500 font-medium text-end border-b-2 border-slate-800">
                {headerLabel}
              </div>
              <ul>
                {group.items.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="p-3 hover:bg-gray-800/60 cursor-pointer rounded"
                    onClick={() =>
                      navigate(
                        `/course/${courseId}/assignment/${assignment.id}`
                      )
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(
                          `/course/${courseId}/assignment/${assignment.id}`
                        );
                      }
                    }}
                  >
                    <div className="">
                      <div className="font-medium text-gray-100">
                        {assignment.name}
                      </div>
                      <span className="ps-5 text-xs text-gray-400">
                        {fmt(assignment.due_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
