import type { FC } from "react";
import type {
  CanvasRubricCriterion,
  CanvasRubricAssessment,
} from "../../../server/trpc/routers/canvasRouter";
import { useRubricQuery } from "../graderHooks";
import Spinner from "../../../utils/Spinner";
import { RubricCriterion } from "./RubricCriterion";

export const RubricDisplay: FC<{
  courseId: number;
  assignmentId: number;
  rubricAssessment?: CanvasRubricAssessment | null;
}> = ({ courseId, assignmentId, rubricAssessment }) => {
  const rubricQuery = useRubricQuery(courseId, assignmentId);

  // Calculate total score from the rubric assessment
  const totalScore = rubricAssessment
    ? Object.values(rubricAssessment).reduce(
        (sum, assessment) => sum + (assessment.points ?? 0),
        0
      )
    : null;

  if (rubricQuery.isLoading) {
    return (
      <section className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          Rubric
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
          Rubric
        </div>
        <div className="rounded border border-gray-700 bg-gray-900 p-3 text-sm text-red-300">
          Failed to load rubric
        </div>
      </section>
    );
  }

  if (!rubricQuery.data) {
    return (
      <section className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          Rubric
        </div>
        <div className="rounded border border-dashed border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-400">
          No rubric found for this assignment
        </div>
      </section>
    );
  }

  const rubric = rubricQuery.data;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400 space-x-4">
          <span>Total: {rubric.points_possible} points</span>
          {totalScore != null && (
            <span className="text-green-400 font-medium">
              Score: {totalScore} pts
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {rubric.data.map((criterion: CanvasRubricCriterion) => (
          <RubricCriterion
            key={criterion.id}
            criterion={criterion}
            assessment={rubricAssessment}
          />
        ))}
      </div>

      {rubric.free_form_criterion_comments && (
        <div className="text-xs text-gray-500 italic">
          This rubric allows free-form comments
        </div>
      )}
    </section>
  );
};
