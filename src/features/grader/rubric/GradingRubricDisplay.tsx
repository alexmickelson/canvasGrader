import type { FC } from "react";
import { useState } from "react";
import { useRubricQuery } from "../graderHooks";
import { useGradeSubmissionMutation } from "../gradeSubmissionHooks";
import Spinner from "../../../utils/Spinner";
import { GradingRubricCriterion } from "./GradingRubricCriterion.js";
import type {
  CanvasSubmission,
  CanvasRubricAssessment,
  CanvasRubricCriterion,
} from "../../../server/trpc/routers/canvas/canvasModels.js";
import { RunAllAnalysis } from "./RunAllAnalysis.js";

export const GradingRubricDisplay: FC<{
  courseId: number;
  assignmentId: number;
  submission: CanvasSubmission;
  rubricAssessment?: CanvasRubricAssessment | null;
  termName: string;
  courseName: string;
  assignmentName: string;
}> = ({
  courseId,
  assignmentId,
  submission,
  rubricAssessment,
  termName,
  courseName,
  assignmentName,
}) => {
  const rubricQuery = useRubricQuery(courseId, assignmentId);
  const gradeSubmissionMutation = useGradeSubmissionMutation();

  // State for the current grading assessment
  const [currentAssessment, setCurrentAssessment] = useState<
    Record<
      string,
      {
        rating_id?: string;
        points?: number;
        comments?: string;
      }
    >
  >(
    // Convert the existing assessment to match our expected type
    Object.fromEntries(
      Object.entries(rubricAssessment || {}).map(([key, value]) => [
        key,
        {
          rating_id: value.rating_id || undefined,
          points: value.points,
          comments: value.comments || undefined,
        },
      ])
    )
  );

  // State for general comment
  const [generalComment, setGeneralComment] = useState("");

  // Calculate total score from current assessment
  const totalScore = Object.values(currentAssessment).reduce(
    (sum, assessment) => sum + (assessment.points ?? 0),
    0
  );

  const handleCriterionChange = (
    criterionId: string,
    assessment: {
      rating_id?: string;
      points?: number;
      comments?: string;
    }
  ) => {
    setCurrentAssessment((prev) => ({
      ...prev,
      [criterionId]: assessment,
    }));
  };

  const handleSubmitGrade = () => {
    if (!submission.user_id) {
      alert("Error: No user ID found for this submission");
      return;
    }

    gradeSubmissionMutation.mutate({
      courseId,
      assignmentId,
      userId: submission.user_id,
      rubricAssessment: currentAssessment,
      comment: generalComment.trim() || undefined,
    });
  };

  const hasChanges = () => {
    // Check if current assessment differs from the original
    const originalKeys = Object.keys(rubricAssessment || {});
    const currentKeys = Object.keys(currentAssessment);

    if (originalKeys.length !== currentKeys.length) return true;

    for (const key of currentKeys) {
      const original = rubricAssessment?.[key];
      const current = currentAssessment[key];

      if (
        original?.rating_id !== current?.rating_id ||
        original?.points !== current?.points ||
        (original?.comments || undefined) !== current?.comments
      ) {
        return true;
      }
    }

    return generalComment.trim().length > 0;
  };

  if (rubricQuery.isLoading) {
    return (
      <section className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          Grading Rubric
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Spinner size={16} className="text-gray-400" />
          Loading rubric...
        </div>
      </section>
    );
  }

  if (rubricQuery.isError) {
    return (
      <section className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          Grading Rubric
        </div>
        <div className="rounded border border-red-700 bg-red-900/20 p-3 text-sm text-red-300">
          <div className="font-medium">Failed to load rubric</div>
          <div className="mt-1 text-xs text-red-400">
            {rubricQuery.error?.message || "Unknown error occurred"}
          </div>
        </div>
      </section>
    );
  }

  if (!rubricQuery.data) {
    return (
      <section className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          Grading Rubric
        </div>
        <div className="rounded border border-dashed border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-400">
          No rubric found for this assignment
        </div>
      </section>
    );
  }

  const rubric = rubricQuery.data;

  return (
    <section className="px-1 pb-1 bg-slate-950 rounded h-full flex flex-col">
      <div className="flex items-center justify-between my-2 ">
        <div className="">
          <RunAllAnalysis
            courseId={courseId}
            assignmentId={assignmentId}
            studentName={submission.user.name}
            termName={termName}
            courseName={courseName}
            assignmentName={assignmentName}
          />
        </div>
        <div className=" text-gray-400 pe-3">
          <span className=" font-bold text-green-400">{totalScore}</span>/
          <span className=" font-bold text-gray-400">
            {rubric.points_possible}
          </span>{" "}
          total
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-auto min-h-0">
        {rubric.data.map((criterion: CanvasRubricCriterion) => (
          <GradingRubricCriterion
            key={criterion.id}
            criterion={criterion}
            assessment={currentAssessment[criterion.id]}
            onChange={(assessment: {
              rating_id?: string;
              points?: number;
              comments?: string;
            }) => handleCriterionChange(criterion.id, assessment)}
            courseId={courseId}
            assignmentId={assignmentId}
            studentName={submission.user.name}
            termName={termName}
            courseName={courseName}
            assignmentName={assignmentName}
          />
        ))}
      </div>

      {/* General Comment */}
      <div className="mt-4 space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          General Comment
        </label>
        <textarea
          value={generalComment}
          onChange={(e) => setGeneralComment(e.target.value)}
          placeholder="Add a general comment about this submission..."
          rows={3}
          className="w-full px-3 py-2  border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Submit Grade Button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSubmitGrade}
          disabled={!hasChanges() || gradeSubmissionMutation.isPending}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors flex items-center gap-2"
        >
          {gradeSubmissionMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Submitting Grade...
            </>
          ) : (
            <>Submit Grade ({totalScore} pts)</>
          )}
        </button>
      </div>

      {rubric.free_form_criterion_comments && (
        <div className="text-xs text-gray-500 italic mt-2">
          This rubric allows free-form comments
        </div>
      )}
    </section>
  );
};
