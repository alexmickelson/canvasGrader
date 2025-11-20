import { useState } from "react";
import Spinner from "../../../utils/Spinner";
import CanvasCourseItem from "../courses/CanvasCourseItem";
import type { CanvasCourse } from "../../../server/trpc/routers/canvas/canvasModels";
import type { UseMutationResult } from "@tanstack/react-query";

const SearchIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const RefreshIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const AvailableCoursesPanel: React.FC<{
  canvasCourses: CanvasCourse[] | undefined;
  isLoadingCourses: boolean;
  refreshCoursesMutation: UseMutationResult<
    CanvasCourse[],
    unknown,
    void,
    unknown
  >;
  selectedCourseIds: number[];
}> = ({
  canvasCourses,
  isLoadingCourses,
  refreshCoursesMutation,
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
    <div className="bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-700 min-h-0 flex flex-col">
      <h3 className="font-semibold mb-3 text-gray-200">Track Course</h3>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-300">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search courses..."
            className="pl-10 w-full p-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => refreshCoursesMutation.mutate()}
          disabled={refreshCoursesMutation.isPending}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg border border-blue-500 flex items-center gap-2 shrink-0"
          title="Refresh courses from Canvas"
        >
          <div
            className={`${
              refreshCoursesMutation.isPending ? "animate-spin" : ""
            }`}
          >
            <RefreshIcon />
          </div>
        </button>
      </div>
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
