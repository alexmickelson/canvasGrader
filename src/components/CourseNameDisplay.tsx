import { useCanvasCoursesQuery } from "../utils/canvas/canvasHooks";
import Spinner from "../utils/Spinner";

export const CourseNameDisplay: React.FC<{ courseId: number }> = ({
  courseId,
}) => {
  const { data: canvasCourses, isLoading: isLoadingCourses } =
    useCanvasCoursesQuery();

  if (isLoadingCourses) {
    return <Spinner />;
  }

  const course = canvasCourses?.find((c) => c.id === courseId);
  const courseName = course?.name;

  return <>{courseName}</>;
};
