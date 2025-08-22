import type { FC } from "react";
import type {
  CanvasRubricCriterion,
  CanvasRubricAssessment,
} from "../../../server/trpc/routers/canvasRouter";

export const RubricCriterion: FC<{
  criterion: CanvasRubricCriterion;
  assessment?: CanvasRubricAssessment | null;
}> = ({ criterion, assessment }) => {
  // Find the assessment data for this criterion using the criterion ID as key
  const criterionAssessment = assessment?.[criterion.id];

  // Find which rating was selected based on the assessment
  const selectedRating = criterionAssessment?.rating_id
    ? criterion.ratings.find((r) => r.id === criterionAssessment.rating_id)
    : null;

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Criterion Header */}
      <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-700">
        <div className="font-medium text-gray-300">
          {criterion.description || `Criterion ${criterion.id}`}
        </div>
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
