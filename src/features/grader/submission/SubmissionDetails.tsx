import type { FC } from "react";
import { useState } from "react";
import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasRouter";
import { AssignmentPreviewComponent } from "../AssignmentPreviewComponent";
import { RubricDisplay } from "../rubric/RubricDisplay";
import { GradingRubricDisplay } from "../rubric/GradingRubricDisplay";
import { SubmissionMetadata } from "./SubmissionMetadata";
import { SubmissionComments } from "./SubmissionComments";

export const SubmissionDetails: FC<{
  submission: CanvasSubmission;
  courseId: number;
}> = ({ submission, courseId }) => {
  const [isGrading, setIsGrading] = useState(false);

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

          {/* Grading Mode Toggle */}
          <div className="mb-3">
            <button
              onClick={() => setIsGrading(!isGrading)}
              className={`
                px-3 py-2 rounded-md text-sm font-medium transition-colors w-full
                ${
                  isGrading
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-600 hover:bg-gray-700 text-gray-300"
                }
              `}
            >
              {isGrading
                ? "📝 Grading Mode (Click to View Only)"
                : "👁️ View Mode (Click to Grade)"}
            </button>
          </div>

          {/* Conditional Rubric Display */}
          {isGrading ? (
            <GradingRubricDisplay
              courseId={courseId}
              assignmentId={submission.assignment_id}
              submission={submission}
              rubricAssessment={submission.rubric_assessment}
            />
          ) : (
            <RubricDisplay
              courseId={courseId}
              assignmentId={submission.assignment_id}
              rubricAssessment={submission.rubric_assessment}
            />
          )}
        </div>
      </div>
    </div>
  );
};
