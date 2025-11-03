import type { FC } from "react";
import { GradingRubricDisplay } from "../rubric/GradingRubricDisplay";
import { SubmissionComments } from "./SubmissionComments";
import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasModels";
import { useAssignmentsQuery } from "../../course/canvasAssignmentHooks";
import { useCanvasCoursesQuery } from "../../home/canvasHooks";
import { SubmissionFileExplorer } from "./fileViewer/SubmissionFileExplorer";
import { useViewingItem } from "../shared/viewingItemContext/ViewingItemContext";
import { ViewFileComponent } from "./fileViewer/ViewFileComponent";
import { AiCriterionAnalysisDisplay } from "../shared/AiCriterionAnalysisDisplay";

export const SubmissionDetailsWrapper: FC<{
  submission: CanvasSubmission;
  courseId: number;
}> = ({ submission, courseId }) => {
  const { data: courses } = useCanvasCoursesQuery();
  // console.log("courses data:", courses, "courseId:", courseId);
  const course = courses.find((c) => Number(c.id) === Number(courseId));
  const { data: assignments } = useAssignmentsQuery();
  const assignment = assignments?.find(
    (a) => a.id === submission.assignment_id
  );

  if (!assignment) {
    return <span className="text-gray-400">Unknown Assignment</span>;
  }
  if (!course) {
    console.log("cannot find course", courseId, courses);
    return <span className="text-gray-400">Unknown Course</span>;
  }

  return (
    <>
      <SubmissionDetails
        submission={submission}
        courseId={courseId}
        assignmentName={assignment.name}
        termName={course.term.name}
        courseName={course.name}
      />
    </>
  );
};

export const SubmissionDetails: FC<{
  submission: CanvasSubmission;
  courseId: number;
  assignmentName: string;
  termName: string;
  courseName: string;
}> = ({ submission, courseId, assignmentName, termName, courseName }) => {
  const { viewingItem } = useViewingItem();

  return (
    <div className="h-full flex flex-col space-y-4 w-full ">
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-96 flex">
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
          <div className={`space-y-4  flex flex-row w-full min-h-0`}>
            <SubmissionFileExplorer
              assignmentId={submission.assignment_id}
              assignmentName={assignmentName}
              studentName={submission.user.name}
              termName={termName}
              courseName={courseName}
            />
            <div className="flex-1 w-96 min-h-0">
              {viewingItem?.type === "file" && viewingItem.name && (
                <ViewFileComponent
                  assignmentId={submission.assignment_id}
                  assignmentName={assignmentName}
                  studentName={submission.user.name}
                  termName={termName}
                  courseName={courseName}
                  filePath={viewingItem.name}
                />
              )}
              {viewingItem?.type === "analysis" && viewingItem.name && (
                <AiCriterionAnalysisDisplay
                  assignmentId={submission.assignment_id}
                  assignmentName={assignmentName}
                  studentName={submission.user.name}
                  termName={termName}
                  courseName={courseName}
                  analysisName={viewingItem.name}
                />
              )}
            </div>
          </div>

          {submission.submission_comments &&
            submission.submission_comments.length > 0 && (
              <SubmissionComments comments={submission.submission_comments} />
            )}
        </div>
      </div>
    </div>
  );
};
