import type { CanvasCourse } from "../../server/trpc/routers/canvasRouter";
import Spinner from "../../utils/Spinner";
import { useSettingsQuery, useUpdateSettingsMutation } from "./settingsHooks";

// SVG Add Icon (self-contained)
const AddIcon = () => (
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
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const CanvasCourseItem = ({ course }: { course: CanvasCourse }) => {
  const { data: settings, isLoading: isLoadingSettings } = useSettingsQuery();

  const courses = settings?.courses || [];
  const updateSettingsMutation = useUpdateSettingsMutation();
  const isSelected = settings?.courses.some((c) => c.canvasId === course.id);
  const isPending = isLoadingSettings || updateSettingsMutation.isPending;
  
  return (
    <li className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 transition-all border border-gray-600">
      <span className="font-medium truncate text-gray-200">{course.name}</span>
      <button
        onClick={() =>
          updateSettingsMutation.mutate({
            courses: [...courses, { name: course.name, canvasId: course.id }],
          })
        }
        disabled={isLoadingSettings || updateSettingsMutation.isPending}
        className={`p-1.5 rounded-full ${
          isSelected
            ? "text-gray-500 cursor-not-allowed"
            : "text-green-400 hover:bg-gray-500"
        } transition-colors`}
        title="Add course"
      >
        {isPending ? (
          <Spinner size={20} className="text-green-400" />
        ) : (
          <AddIcon />
        )}
      </button>
    </li>
  );
};

export default CanvasCourseItem;
