import type { FC } from "react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAssignmentsQuery } from "./canvasAssignmentHooks";

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
    const q = filter.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => a.name.toLowerCase().includes(q));
  }, [assignments, filter]);

  const fmt = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "No due date";

  return (
    <div className="mt-4">
      <div className="mb-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter assignments..."
          className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-700"
        />
      </div>
      <ul className="divide-y divide-gray-800">
        {filtered.map((assignment) => (
          <li
            key={assignment.id}
            className="p-3 hover:bg-gray-800/60 cursor-pointer"
            onClick={() =>
              navigate(`/course/${courseId}/assignment/${assignment.id}`)
            }
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(`/course/${courseId}/assignment/${assignment.id}`);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-100">{assignment.name}</h2>
              <span className="text-xs text-gray-400">
                Due: {fmt(assignment.due_at)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
