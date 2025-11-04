import type { FC } from "react";
import { useAllEvaluationsQuery } from "../graderHooks";
import { AnalysisItem } from "./AnalysisItem";

type RubricRating = {
  id: string;
  description?: string;
  long_description?: string;
  points: number;
};

export const CriterionPointInput: FC<{
  customPoints?: number;
  ratings: RubricRating[];
  onRatingSelect: (ratingId: string | undefined, points: number) => void;

  courseId: number;
  assignmentId: number;
  studentName: string;
  assignmentName: string;
  criterionId: string;

  assessment?: {
    rating_id?: string;
    points?: number;
    comments?: string;
  };
}> = ({
  customPoints,
  ratings,
  onRatingSelect,
  assignmentId,
  assignmentName,
  studentName,
  criterionId,
  assessment,
}) => {
  // Get analysis data for this criterion
  const { data: allEvaluations } = useAllEvaluationsQuery({
    assignmentId,
    assignmentName,
    studentName,
  });

  const criterionEvaluations =
    allEvaluations?.filter((evaluation) =>
      evaluation.fileName.includes(`rubric.${criterionId}-`)
    ) ?? [];

  const evaluationsByPoints = criterionEvaluations.reduce((acc, evaluation) => {
    const points = evaluation.evaluation.recommendedPoints;
    if (!acc[points]) acc[points] = [];
    acc[points].push(evaluation);
    return acc;
  }, {} as Record<number, typeof criterionEvaluations>);

  const allPoints = Array.from(
    new Set([
      ...ratings.map((r) => r.points),
      ...Object.keys(evaluationsByPoints).map(Number),
    ])
  ).sort((a, b) => a - b);

  return (
    <div className="flex gap-2">
      {allPoints.map((points) => {
        const rating = ratings.find((r) => r.points === points);
        const isSelected = customPoints === points;
        const matchesAssessment = assessment?.points === points;
        const evaluations = evaluationsByPoints[points] || [];

        const buttonClass = `
          unstyled cursor-pointer
          py-3 px-3 rounded transition-all 
          ${
            isSelected
              ? "bg-blue-950 border-2 border-blue-700 text-white"
              : matchesAssessment
              ? "border-2 border-green-900 text-gray-300 hover:bg-gray-800"
              : "border border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500"
          }
        `;

        return (
          <div key={points} className="flex-1 flex flex-col">
            {rating ? (
              // Show predefined rating button
              <button
                onClick={() => onRatingSelect(rating.id, rating.points)}
                className={buttonClass}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{rating.points}</span>
                  {rating.description && (
                    <span className="text-xs opacity-80">
                      {rating.description}
                    </span>
                  )}
                </div>
                {rating.long_description && (
                  <div className="text-xs opacity-70 mt-1 max-w-32 truncate">
                    {rating.long_description}
                  </div>
                )}
              </button>
            ) : (
              <button
                onClick={() => onRatingSelect(undefined, points)}
                className={buttonClass}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{points}</span>
                  <span className="text-xs opacity-80">ai recommendation</span>
                </div>
              </button>
            )}

            {evaluations.length > 0 && (
              <div className="mt-2 space-y-1">
                {evaluations.map((evaluation) => (
                  <AnalysisItem
                    key={evaluation.filePath}
                    evaluation={evaluation}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
