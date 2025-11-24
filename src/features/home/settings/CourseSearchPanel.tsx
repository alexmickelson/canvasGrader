import type { FC } from "react";
import { useRefreshCanvasCoursesQuery } from "../hooks/canvasHooks";

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

export const CourseSearchPanel: FC<{
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}> = ({ searchQuery, setSearchQuery }) => {
  const refreshCoursesMutation = useRefreshCanvasCoursesQuery();
  return (
    <div className="flex gap-2 mb-3">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-300">
          <SearchIcon />
        </div>
        <input
          type="text"
          placeholder="Search courses..."
          className={
            "unstyled pl-10 w-full p-2 border border-gray-700 rounded-lg bg-gray-900 " +
            "text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-950 focus:border-blue-950 text-sm"
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <button
        onClick={() => refreshCoursesMutation.mutate()}
        disabled={refreshCoursesMutation.isPending}
        className={
          "unstyled px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-950 disabled:opacity-50 " +
          "text-slate-400 rounded-lg flex items-center gap-2 shrink-0"
        }
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
  );
};
