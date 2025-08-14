import type { SettingsCourse } from "../../server/trpc/routers/settingsRouter";
import Spinner from "../../utils/Spinner";
import { useSettingsQuery, useUpdateSettingsMutation } from "./settingsHooks";
import { useNavigate } from "react-router";

const RemoveIcon = () => (
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
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const SelectedCourseItem = ({ course }: { course: SettingsCourse }) => {
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();
  const navigate = useNavigate();

  const courses = settings?.courses || [];
  const isPending = updateSettingsMutation.isPending;

  return (
    <li
      className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 transition-all border border-blue-700 cursor-pointer"
      onClick={() => navigate(`/course/${course.canvasId}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/course/${course.canvasId}`);
        }
      }}
    >
      <span className="font-medium truncate text-gray-200">{course.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          updateSettingsMutation.mutate({
            courses: courses.filter((c) => c.canvasId !== course.canvasId),
          });
        }}
        disabled={isPending}
        className="p-1.5 rounded-full text-red-400 hover:bg-gray-700 transition-colors"
        title="Remove course"
      >
        {isPending ? (
          <Spinner size={20} className="text-red-400" />
        ) : (
          <RemoveIcon />
        )}
      </button>
    </li>
  );
};

export default SelectedCourseItem;
