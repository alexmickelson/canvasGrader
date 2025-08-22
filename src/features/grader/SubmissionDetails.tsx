import type { FC } from "react";
import type { CanvasSubmission } from "../../server/trpc/routers/canvasRouter";
import { AssignmentPreviewComponent } from "./AssignmentPreviewComponent";
import { RubricDisplay } from "./rubric/RubricDisplay";
import { SubmissionHeader } from "./SubmissionHeader";
import { SubmissionComments } from "./SubmissionComments";

export const SubmissionDetails: FC<{
  submission: CanvasSubmission;
  courseId: number;
}> = ({ submission, courseId }) => {
  return (
    <div className="space-y-4">
      <SubmissionHeader submission={submission} />

      <div className="flex gap-4 w-full">
        <div className="flex-1">
          <AssignmentPreviewComponent
            submission={submission}
            courseId={courseId}
          />

          {submission.submission_comments &&
            submission.submission_comments.length > 0 && (
              <SubmissionComments comments={submission.submission_comments} />
            )}
        </div>
        <div className="min-w-96">
          <RubricDisplay
            courseId={courseId}
            assignmentId={submission.assignment_id}
            rubricAssessment={submission.rubric_assessment}
          />
        </div>
      </div>
    </div>
  );
};
