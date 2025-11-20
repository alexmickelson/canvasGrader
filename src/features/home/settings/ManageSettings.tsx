import {
  useCanvasCoursesQuery,
  useRefreshCanvasCoursesQuery,
} from "../hooks/canvasHooks";
import { useSettingsQuery } from "../hooks/settingsHooks";
import { AvailableCoursesPanel } from "./AvailableCoursesPanel";
import { SelectedCoursesPanel } from "./SelectedCoursesPanel";

export const ManageSettings = () => {
  const { data: settings, isLoading: isLoadingSettings } = useSettingsQuery();
  const { data: canvasCourses, isLoading: isLoadingCourses } =
    useCanvasCoursesQuery();
  const refreshCoursesMutation = useRefreshCanvasCoursesQuery();

  const courses = settings?.courses || [];

  return (
    <div className="space-y-6  min-h-0 flex flex-col">
      <h1 className="text-center">Grader</h1>
      <div className="flex-1 min-h-0 gap-6 flex flex-col ">
        <div className="flex justify-center">
          <div className="w-[600px]">
            <SelectedCoursesPanel
              courses={courses}
              isLoadingSettings={isLoadingSettings}
            />
          </div>
        </div>
        <br />
        <div className="flex-1 min-h-0 flex justify-center">
          <div className="w-[600px] min-h-0 flex flex-col">
            <AvailableCoursesPanel
              canvasCourses={canvasCourses}
              isLoadingCourses={isLoadingCourses}
              refreshCoursesMutation={refreshCoursesMutation}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
