import type { FC } from "react";
import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasModels";
import { useAssignmentsQuery } from "../../course/canvasAssignmentHooks";
import { useCanvasCoursesQuery } from "../../home/canvasHooks";
import { AnalysisView } from "./AnalysisView";

export const AnalysisWrapper: FC<{
  submission: CanvasSubmission;
  courseId: number;
}> = ({ submission, courseId }) => {
  const { data: courses } = useCanvasCoursesQuery();
  const course = courses.find((c) => Number(c.id) === Number(courseId));
  const { data: assignments } = useAssignmentsQuery(courseId);
  const assignment = assignments?.find(
    (a) => a.id === submission.assignment_id
  );

  if (!assignment) {
    return <span className="text-gray-400">Unknown Assignment</span>;
  }
  if (!course) {
    return <span className="text-gray-400">Unknown Course</span>;
  }

  return (
    <AnalysisView
      assignmentId={submission.assignment_id}
      studentName={submission.user.name}
      assignmentName={assignment.name}
      termName={course.term.name}
      courseName={course.name}
    />
  );
};
