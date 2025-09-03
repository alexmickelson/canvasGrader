import type { FC } from "react";
import { RubricRatings } from "./RubricRatings";
import type { CanvasRubricCriterion, CanvasRubricAssessment } from "../../../server/trpc/routers/canvas/canvasModels";

export const RubricCriterion: FC<{
  criterion: CanvasRubricCriterion;
  assessment?: CanvasRubricAssessment | null;
}> = ({ criterion, assessment }) => {
  const criterionAssessment = assessment?.[criterion.id];

  const selectedRating = criterionAssessment?.rating_id
    ? criterion.ratings.find((r) => r.id === criterionAssessment.rating_id)
    : null;

  return (
    <div className=" overflow-hidden border-2 p-1 border-slate-900 rounded">
      {/* Criterion Header */}
      <div className=" px-1 pb-1 flex justify-between">
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
              /
              <span className="font-bold text-slate-200">
                {criterion.points}
              </span>{" "}
              pts
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
      <div className="ps-3 pt-1">
        <div className=" flex flex-row gap-3">
          {criterion.ratings
            .sort((a, b) => a.points - b.points)
            .map((rating) => {
              return (
                <RubricRatings
                  key={rating.id}
                  rating={rating}
                  selectedRating={selectedRating}
                />
              );
            })}
        </div>
      </div>
    </div>
  );
};
