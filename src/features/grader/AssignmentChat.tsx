import { useCurrentCourse } from '../../components/contexts/CourseProvider';
import { useCurrentAssignment } from '../../components/contexts/AssignmentProvider';

export const AssignmentChat = () => {
  const { courseId } = useCurrentCourse();
  const { assignmentId, assignmentName } = useCurrentAssignment();
  return (
    <div>AssignmentChat</div>
  )
}
