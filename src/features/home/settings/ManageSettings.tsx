import { useState } from "react";
import {
  useCanvasCoursesQuery,
  useRefreshCanvasCoursesQuery,
} from "../hooks/canvasHooks";
import { useSettingsQuery } from "../hooks/settingsHooks";
import { AvailableCoursesPanel } from "./AvailableCoursesPanel";
import { SelectedCoursesPanel } from "./SelectedCoursesPanel";

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

  return (
    <div className="space-y-6 bg-gray-900 p-6 rounded-xl min-h-0 flex flex-col">
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

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-6 ">
        <AvailableCoursesPanel
          canvasCourses={canvasCourses}
          isLoadingCourses={isLoadingCourses}
          searchQuery={searchQuery}
        />
        <SelectedCoursesPanel
          courses={courses}
          isLoadingSettings={isLoadingSettings}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  );
};
