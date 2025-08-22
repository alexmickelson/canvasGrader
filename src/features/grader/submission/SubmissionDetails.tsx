import type { FC } from "react";
import type { CanvasSubmission } from "../../../server/trpc/routers/canvasRouter";
import { AssignmentPreviewComponent } from "../AssignmentPreviewComponent";
import { RubricDisplay } from "../rubric/RubricDisplay";
import { SubmissionMetadata } from "./SubmissionMetadata";
import { SubmissionComments } from "./SubmissionComments";

export const SubmissionDetails: FC<{
  submission: CanvasSubmission;
  courseId: number;
}> = ({ submission, courseId }) => {
  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex gap-4 w-full flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-auto space-y-4">
            <AssignmentPreviewComponent
              submission={submission}
              courseId={courseId}
            />

            {submission.submission_comments &&
              submission.submission_comments.length > 0 && (
                <SubmissionComments comments={submission.submission_comments} />
              )}
          </div>
        </div>
        <div className="min-w-96">
          <SubmissionMetadata submission={submission} />
          <br />
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
