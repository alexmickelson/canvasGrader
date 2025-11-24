import { useState } from "react";
import Spinner from "../../../utils/Spinner";
import CanvasCourseItem from "../courses/CanvasCourseItem";
import type { CanvasCourse } from "../../../server/trpc/routers/canvas/canvasModels";
import { CourseSearchPanel } from "./CourseSearchPanel";

export const AvailableCoursesPanel: React.FC<{
  canvasCourses: CanvasCourse[] | undefined;
  isLoadingCourses: boolean;
  selectedCourseIds: number[];
}> = ({
  canvasCourses,
  isLoadingCourses,
  selectedCourseIds,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCanvasCourses =
    canvasCourses?.filter(
      (course) =>
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !selectedCourseIds.includes(course.id)
    ) || [];

  const toTime = (d?: string | null) => (d ? Date.parse(d) : NaN);
  const fmt = (d: number) =>
    isFinite(d)
      ? new Date(d).toLocaleString(undefined, {
          month: "short",
          year: "numeric",
        })
      : "";

  const groupedByTerm = filteredCanvasCourses
    .filter((course) => course.term?.name !== "The End of Time")
    .reduce((acc, course) => {
      const termId = course.term?.id ?? "unknown";
      const key = String(termId);
      const start = toTime(course.term?.start_at ?? null);
      const end = toTime(course.term?.end_at ?? null);
      const created = toTime(course.created_at ?? null);
      const sortTime = isFinite(end)
        ? end
        : isFinite(start)
        ? start
        : isFinite(created)
        ? created
        : -Infinity;
      const dateLabel = [fmt(start), fmt(end)].filter(Boolean).join(" — ");
      const termName = course.term?.name ?? "Unknown Term";

      const existing = acc.find((g) => g.key === key);
      if (existing) {
        return acc.map((g) =>
          g.key === key
            ? {
                ...g,
                courses: [...g.courses, course],
                sortTime: Math.max(g.sortTime, sortTime),
                dateLabel: g.dateLabel || dateLabel,
                termName:
                  g.termName === "Unknown Term" && termName !== "Unknown Term"
                    ? termName
                    : g.termName,
              }
            : g
        );
      }

      return [
        ...acc,
        {
          key,
          termName,
          dateLabel,
          sortTime,
          courses: [course],
        },
      ];
    }, [] as Array<{ key: string; termName: string; dateLabel: string; sortTime: number; courses: CanvasCourse[] }>)
    .sort((a, b) => b.sortTime - a.sortTime);

  return (
    <div className=" rounded-lg shadow-lg p-4 border border-gray-700 min-h-0 flex flex-col">
      <h3 className="font-semibold mb-3 text-gray-200">Track Course</h3>
      <CourseSearchPanel
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      {isLoadingCourses ? (
        <div className="flex justify-center p-4">
          <Spinner className="text-blue-400" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2">
          {groupedByTerm.length > 0 ? (
            <div className="space-y-4">
              {groupedByTerm.map((group) => (
                <div key={group.key}>
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-xs uppercase tracking-wide text-gray-400">
                      {group.termName}
                    </h4>
                    {group.dateLabel ? (
                      <span className="text-[11px] text-gray-500">
                        {group.dateLabel}
                      </span>
                    ) : null}
                  </div>
                  <ul className="space-y-2 mt-2">
                    {group.courses.map((course) => (
                      <CanvasCourseItem key={course.id} course={course} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-4">
              No matching courses found
            </p>
          )}
        </div>
      )}
    </div>
  );
};
