import { useAssignmentsQuery } from "../course/canvasAssignmentHooks";

export const AssignmentName = ({
  assignmentId,
  courseId,
}: {
  assignmentId: number;
  courseId: number;
}) => {
  const { data: assignments } = useAssignmentsQuery(courseId);
  const assignment = assignments?.find((a) => a.id === assignmentId);
  if (!assignment) {
    return <span className="text-gray-400">Unknown Assignment</span>;
  }

  return <span className="text-gray-200">{assignment.name}</span>;
};
