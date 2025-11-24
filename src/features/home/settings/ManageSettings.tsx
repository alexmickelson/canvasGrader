import {
  useCanvasCoursesQuery,
} from "../hooks/canvasHooks";
import { useFavoriteCoursesQuery } from "../hooks/settingsHooks";
import { AvailableCoursesPanel } from "./AvailableCoursesPanel";
import { SelectedCoursesPanel } from "./SelectedCoursesPanel";

export const ManageSettings = () => {
  const { data: favoriteCourses, isLoading: isLoadingFavorites } =
    useFavoriteCoursesQuery();
  const { data: canvasCourses, isLoading: isLoadingCourses } =
    useCanvasCoursesQuery();

  const courses = favoriteCourses || [];

  return (
    <div className="space-y-6  min-h-0 flex flex-col">
      <h1 className="text-center">Grader</h1>
      <div className="flex-1 min-h-0 gap-6 flex flex-col ">
        <div className="flex justify-center">
          <div className="w-[600px]">
            <SelectedCoursesPanel
              courses={courses}
              isLoadingSettings={isLoadingFavorites}
            />
          </div>
        </div>
        <br />
        <div className="flex-1 min-h-0 flex justify-center">
          <div className="w-[600px] min-h-0 flex flex-col">
            <AvailableCoursesPanel
              canvasCourses={canvasCourses}
              isLoadingCourses={isLoadingCourses}
              selectedCourseIds={courses.map((c) => c.id)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
