import { useMemo, useState } from "react";
import {
  useCanvasCoursesQuery,
  useRefreshCanvasCoursesQuery,
} from "./canvasHooks";
import { useSettingsQuery } from "./settingsHooks";
import Spinner from "../../utils/Spinner";
import CanvasCourseItem from "./CanvasCourseItem";
import SelectedCourseItem from "./SelectedCourseItem";
import type { SettingsCourse } from "../../server/trpc/routers/settingsRouter";
import type { CanvasCourse } from "../../server/trpc/routers/canvas/canvasModels";

// RemoveIcon inlined moved to SelectedCourseItem

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

export const ManageSettings = () => {
  const { data: settings, isLoading: isLoadingSettings } = useSettingsQuery();
  const { data: canvasCourses, isLoading: isLoadingCourses } =
    useCanvasCoursesQuery();
  const refreshCoursesMutation = useRefreshCanvasCoursesQuery();
  const [searchQuery, setSearchQuery] = useState("");

  const courses = settings?.courses || [];

  const filteredCanvasCourses = useMemo(() => {
    return (
      canvasCourses?.filter((course) =>
        course.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) || []
    );
  }, [canvasCourses, searchQuery]);

  const filteredSelectedCourses =
    courses?.filter((course) =>
      course.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  // Group available courses by term (semester) and sort groups by most recent
  const groupedByTerm = useMemo(() => {
    const toTime = (d?: string | null) => (d ? Date.parse(d) : NaN);
    const fmt = (d: number) =>
      isFinite(d)
        ? new Date(d).toLocaleString(undefined, {
            month: "short",
            year: "numeric",
          })
        : "";

    const map = new Map<
      string,
      {
        key: string;
        termName: string;
        dateLabel: string;
        sortTime: number;
        courses: CanvasCourse[];
      }
    >();

    for (const course of filteredCanvasCourses as CanvasCourse[]) {
      // Skip the special Canvas term "The End of Time"
      if (course.term?.name === "The End of Time") continue;
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

      if (!map.has(key)) {
        map.set(key, {
          key,
          termName,
          dateLabel,
          sortTime,
          courses: [],
        });
      }
      const group = map.get(key)!;
      group.courses.push(course);
      group.sortTime = Math.max(group.sortTime, sortTime);
      if (!group.dateLabel && dateLabel) group.dateLabel = dateLabel;
      if (group.termName === "Unknown Term" && termName !== "Unknown Term") {
        group.termName = termName;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.sortTime - a.sortTime);
  }, [filteredCanvasCourses]);

  return (
    <div className="space-y-6 bg-gray-900 p-6 rounded-xl">
      <h2 className="text-xl font-bold mb-4 text-gray-100">Canvas Courses</h2>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-300">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search courses..."
            className="pl-10 w-full p-2 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => refreshCoursesMutation.mutate()}
          disabled={refreshCoursesMutation.isPending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg border border-blue-500 flex items-center gap-2 min-w-fit"
          title="Refresh courses from Canvas"
        >
          <div
            className={`${
              refreshCoursesMutation.isPending ? "animate-spin" : ""
            }`}
          >
            <RefreshIcon />
          </div>
          {refreshCoursesMutation.isPending ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Available Courses */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-700">
          <h3 className="font-semibold mb-3 text-gray-200">
            Available Courses
          </h3>
          {isLoadingCourses ? (
            <div className="flex justify-center p-4">
              <Spinner size={24} className="text-blue-400" />
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
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

        {/* Selected Courses */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-700">
          <h3 className="font-semibold mb-3 text-gray-200">Selected Courses</h3>
          {isLoadingSettings ? (
            <div className="flex justify-center p-4">
              <Spinner  className="text-blue-400" />
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              {filteredSelectedCourses.length > 0 ? (
                <ul className="space-y-2">
                  {filteredSelectedCourses.map((course: SettingsCourse) => (
                    <SelectedCourseItem key={course.canvasId} course={course} />
                  ))}
                </ul>
              ) : (
                <p className="text-center text-gray-400 py-4">
                  No courses selected
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
