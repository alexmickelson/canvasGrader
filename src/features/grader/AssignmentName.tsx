import { useCurrentAssignment } from "../../components/contexts/AssignmentProvider";

export const AssignmentName = () => {
  const { assignmentName } = useCurrentAssignment();

  return <span className="text-gray-200">{assignmentName}</span>;
};
