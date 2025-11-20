import Spinner from "../../../utils/Spinner";
import SelectedCourseItem from "../courses/SelectedCourseItem";
import type { SettingsCourse } from "../../../server/trpc/routers/settingsRouter";

export const SelectedCoursesPanel: React.FC<{
  courses: SettingsCourse[];
  isLoadingSettings: boolean;
}> = ({ courses, isLoadingSettings }) => {

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-700 min-h-0 flex flex-col">
      {isLoadingSettings ? (
        <div className="flex justify-center p-4">
          <Spinner className="text-blue-400" />
        </div>
      ) : (
        <div className="overflow-y-auto">
          {courses.length > 0 ? (
            <div className="gap-y-2 flex flex-col" >
              {courses.map((course: SettingsCourse) => (
                <SelectedCourseItem key={course.canvasId} course={course} />
              ))}
            </div>
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
