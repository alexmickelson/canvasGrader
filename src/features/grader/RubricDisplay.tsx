import type { FC } from "react";
import type {
  CanvasRubricCriterion,
  CanvasRubricAssessment,
} from "../../server/trpc/routers/canvasRouter";
import { useRubricQuery } from "./graderHooks";
import Spinner from "../../utils/Spinner";

interface RubricDisplayProps {
  courseId: number;
  assignmentId: number;
  rubricAssessment?: CanvasRubricAssessment | null;
}

const RubricCriterion: FC<{
  criterion: CanvasRubricCriterion;
  assessment?: CanvasRubricAssessment | null;
}> = ({ criterion, assessment }) => {
  // Find the assessment data for this criterion
  const criterionAssessment = assessment?.data?.find(
    (data) => data.criterion_id === criterion.id
  );

  // Find which rating was selected based on the assessment
  const selectedRating = criterionAssessment?.rating_id
    ? criterion.ratings.find((r) => r.id === criterionAssessment.rating_id)
    : null;

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Criterion Header */}
      <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-700">
        <h4 className="font-medium text-gray-100">
          {criterion.description || `Criterion ${criterion.id}`}
        </h4>
        {criterion.long_description && (
          <p className="mt-1 text-sm text-gray-400">
            {criterion.long_description}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>Max Points: {criterion.points}</span>
          {criterionAssessment && (
            <span className="text-green-400 font-medium">
              Scored: {criterionAssessment.points ?? 0} pts
            </span>
          )}
        </div>
      </div>

      {/* Assessment Comments */}
      {criterionAssessment?.comments && (
        <div className="px-4 py-2 bg-blue-500/10 border-b border-gray-700">
          <div className="text-xs uppercase tracking-wide text-blue-300 mb-1">
            Grader Comments
          </div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap">
            {criterionAssessment.comments}
          </div>
        </div>
      )}

      {/* Ratings */}
      <div className="p-4">
        <div className="grid gap-2">
          {criterion.ratings.map((rating) => {
            const isSelected = selectedRating?.id === rating.id;
            return (
              <div
                key={rating.id}
                className={`flex items-center justify-between p-3 rounded-md ${
                  isSelected
                    ? "bg-green-500/20 border border-green-500/40"
                    : "bg-gray-800/30"
                }`}
              >
                <div className="flex-1">
                  <div
                    className={`font-medium ${
                      isSelected ? "text-green-200" : "text-gray-200"
                    }`}
                  >
                    {isSelected && "✓ "}
                    {rating.description || `Rating ${rating.id}`}
                  </div>
                  {rating.long_description && (
                    <div className="mt-1 text-sm text-gray-400">
                      {rating.long_description}
                    </div>
                  )}
                </div>
                <div
                  className={`ml-4 text-sm font-medium px-2 py-1 rounded ${
                    isSelected
                      ? "text-green-100 bg-green-700"
                      : "text-gray-100 bg-gray-700"
                  }`}
                >
                  {rating.points} pts
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const RubricDisplay: FC<RubricDisplayProps> = ({
  courseId,
  assignmentId,
  rubricAssessment,
}) => {
  const rubricQuery = useRubricQuery(courseId, assignmentId);

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
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Rubric
          </div>
          <h3 className="font-semibold text-gray-100">{rubric.title}</h3>
        </div>
        <div className="text-sm text-gray-400 space-x-4">
          <span>Total: {rubric.points_possible} points</span>
          {rubricAssessment?.score != null && (
            <span className="text-green-400 font-medium">
              Score: {rubricAssessment.score} pts
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
