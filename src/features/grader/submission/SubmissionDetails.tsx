import type { FC } from "react";
import { GradingRubricDisplay } from "../rubric/GradingRubricDisplay";
import { SubmissionComments } from "./SubmissionComments";
import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasModels";
import { useAssignmentsQuery } from "../../course/canvasAssignmentHooks";
import { useCanvasCoursesQuery } from "../../home/canvasHooks";
import { SubmissionFileExplorer } from "./fileViewer/SubmissionFileExplorer";
import { useDownloadAttachmentsQuery } from "../graderHooks";

export const SubmissionDetailsWrapper: FC<{
  submission: CanvasSubmission;
  courseId: number;
}> = ({ submission, courseId }) => {
  const { data: courses } = useCanvasCoursesQuery();
  // console.log("courses data:", courses, "courseId:", courseId);
  const course = courses.find((c) => Number(c.id) === Number(courseId));
  const { data: assignments } = useAssignmentsQuery(courseId);
  const assignment = assignments?.find(
    (a) => a.id === submission.assignment_id
  );

  // make sure attachments are downloaded
  useDownloadAttachmentsQuery({
    courseId,
    assignmentId: submission.assignment_id,
    userId: submission.user_id,
  });
  if (!assignment) {
    return <span className="text-gray-400">Unknown Assignment</span>;
  }
  if (!course) {
    return <span className="text-gray-400">Unknown Course</span>;
  }

  return (
    <SubmissionDetails
      submission={submission}
      courseId={courseId}
      assignmentName={assignment.name}
      termName={course.term.name}
      courseName={course.name}
    />
  );
};

export const SubmissionDetails: FC<{
  submission: CanvasSubmission;
  courseId: number;
  assignmentName: string;
  termName: string;
  courseName: string;
}> = ({ submission, courseId, assignmentName, termName, courseName }) => {
  return (
    <div className="h-full flex flex-col space-y-4 w-full">
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="min-w-96">
          <GradingRubricDisplay
            key={submission.id}
            courseId={courseId}
            assignmentId={submission.assignment_id}
            submission={submission}
            rubricAssessment={submission.rubric_assessment}
            termName={termName}
            courseName={courseName}
            assignmentName={assignmentName}
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <SubmissionFileExplorer
            assignmentId={submission.assignment_id}
            assignmentName={assignmentName}
            studentName={submission.user.name}
            termName={termName}
            courseName={courseName}
          />

          {submission.submission_comments &&
            submission.submission_comments.length > 0 && (
              <SubmissionComments comments={submission.submission_comments} />
            )}
        </div>
      </div>
    </div>
  );
};
