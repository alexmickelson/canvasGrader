import type { FC } from "react";
import type {
  CanvasRubricCriterion,
  CanvasRubricAssessment,
} from "../../../server/trpc/routers/canvas/canvasRouter";
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
    <section className="px-1 pb-1 bg-slate-950 rounded">
      <div className="flex items-center justify-end">
        <div className="text-sm text-gray-400 pe-3">
          {totalScore != null ? (
            <span>
              <span className="font-bold text-green-400">{totalScore}</span>/
              <span className="font-bold">{rubric.points_possible}</span> pts
            </span>
          ) : (
            <span>
              Total: <span className="font-bold">{rubric.points_possible}</span>{" "}
              pts available
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
