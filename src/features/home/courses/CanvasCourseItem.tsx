import type { CanvasCourse } from "../../../server/trpc/routers/canvas/canvasModels";
import Spinner from "../../../utils/Spinner";
import {
  useFavoriteCoursesQuery,
  useAddFavoriteCourseMutation,
} from "../hooks/settingsHooks";

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
  const { data: favoriteCourses, isLoading: isLoadingFavorites } =
    useFavoriteCoursesQuery();

  const addFavoriteMutation = useAddFavoriteCourseMutation();
  const isSelected = favoriteCourses?.some((c) => c.id === course.id);
  const isPending = isLoadingFavorites || addFavoriteMutation.isPending;

  return (
    <li className="flex items-center justify-between p-3 rounded-lg bg-linear-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 transition-all border border-gray-600">
      <span className="font-medium truncate text-gray-200">{course.name}</span>
      <button
        onClick={() =>
          addFavoriteMutation.mutate({
            courseId: course.id,
            courseName: course.name,
          })
        }
        disabled={isPending}
        className={`p-1.5 rounded-full ${
          isSelected
            ? "text-gray-500 cursor-not-allowed"
            : "text-green-400 hover:bg-gray-500"
        } transition-colors`}
        title="Add course"
      >
        {isPending ? <Spinner className="text-green-400" /> : <AddIcon />}
      </button>
    </li>
  );
};

export default CanvasCourseItem;
