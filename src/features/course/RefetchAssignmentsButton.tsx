import { useRefreshAssignmentsMutation } from "./canvasAssignmentHooks";
import Spinner from "../../utils/Spinner";
import { useCurrentCourse } from "../../components/contexts/CourseProvider";

export const RefetchAssignmentsButton = () => {
  const { courseId } = useCurrentCourse();
  const updateAssignmentsMutation = useRefreshAssignmentsMutation();

  return (
    <button
      onClick={() => updateAssignmentsMutation.mutate({ courseId })}
      disabled={updateAssignmentsMutation.isPending}
    >
      Refetch Assignemnts
      {updateAssignmentsMutation.isPending && <Spinner />}
    </button>
  );
};
