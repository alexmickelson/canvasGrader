import { useMemo } from "react";
import Spinner from "../../../utils/Spinner";
import SelectedCourseItem from "../courses/SelectedCourseItem";
import type { SettingsCourse } from "../../../server/trpc/routers/settingsRouter";

export const SelectedCoursesPanel: React.FC<{
  courses: SettingsCourse[];
  isLoadingSettings: boolean;
  searchQuery: string;
}> = ({ courses, isLoadingSettings, searchQuery }) => {
  const filteredSelectedCourses = useMemo(
    () =>
      courses?.filter((course) =>
        course.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) || [],
    [courses, searchQuery]
  );

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-700 min-h-0 flex flex-col">
      <h3 className="font-semibold mb-3 text-gray-200">Selected Courses</h3>
      {isLoadingSettings ? (
        <div className="flex justify-center p-4">
          <Spinner className="text-blue-400" />
        </div>
      ) : (
        <div className="overflow-y-auto pr-2">
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
  );
};
