import { useCanvasCoursesQuery } from "./canvasHooks";
import { useSettingsQuery, useUpdateSettingsMutation } from "./settingsHooks";

export const ManageSettings = () => {
  const { data: settings } = useSettingsQuery();
  const { data: canvasCourses } = useCanvasCoursesQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();

  const courses = settings?.courses || [];

  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();

    updateSettingsMutation.mutate({
      courses: [...courses],
    });
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-2">Canvas Courses</h2>
      <form onSubmit={handleAddCourse} className="flex gap-2 mb-4">
        <ul>
          {canvasCourses.map((c) => (
            <li key={c.id}>{c.name} </li>
          ))}
        </ul>

        <ul>
          {courses.map((course: { name: string; canvasId: number }) => (
            <li key={course.canvasId} className="flex items-center gap-2">
              <span>{course.name}</span>
              <button
                onClick={() =>
                  updateSettingsMutation.mutate({
                    courses: courses.filter(
                      (c: { name: string }) => c.name !== course.name
                    ),
                  })
                }
                className="text-red-500 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </form>
    </div>
  );
};
