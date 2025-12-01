import SelectedCourseItem from "../courses/SelectedCourseItem";
import { useFavoriteCoursesQuery } from "../settingsHooks";

export type FavoriteCourse = { id: number; name: string };

export const SelectedCoursesPanel = () => {
  const { data: courses } = useFavoriteCoursesQuery();
  return (
    <div className=" rounded-lg shadow-lg p-4  min-h-0 flex flex-col">
      <div className="overflow-y-auto">
        {courses.length > 0 ? (
          <div className="gap-y-2 flex flex-col">
            {courses.map((course) => (
              <SelectedCourseItem key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 py-4">No courses selected</p>
        )}
      </div>
    </div>
  );
};
