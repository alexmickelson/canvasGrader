import type { FC } from "react";
import type {
  CanvasRubricCriterion,
  CanvasRubricAssessment,
} from "../../../server/trpc/routers/canvasRouter";

export const RubricCriterion: FC<{
  criterion: CanvasRubricCriterion;
  assessment?: CanvasRubricAssessment | null;
}> = ({ criterion, assessment }) => {
  const criterionAssessment = assessment?.[criterion.id];

  
  const selectedRating = criterionAssessment?.rating_id
    ? criterion.ratings.find((r) => r.id === criterionAssessment.rating_id)
    : null;

  return (
    <div className="border border-gray-700 overflow-hidden">
      {/* Criterion Header */}
      <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-700 flex justify-between">
        <div>
          <div className="font-medium text-gray-300">
            {criterion.description || `Criterion ${criterion.id}`}
          </div>
          {criterion.long_description && (
            <p className="mt-1 text-sm text-gray-400">
              {criterion.long_description}
            </p>
          )}
        </div>
        <div className=" text-gray-500">
          {criterionAssessment ? (
            <span>
              <span className="font-bold text-green-300">
                {criterionAssessment.points ?? 0}
              </span>
              /<span className="font-bold text-slate-200">{criterion.points}</span> pts
            </span>
          ) : (
            <span>
              <span className="font-bold">{criterion.points}</span> pts
              available
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
