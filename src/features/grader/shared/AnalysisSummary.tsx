import type { FC } from "react";
import type { CanvasRubricCriterion } from "../../../server/trpc/routers/canvas/canvasModels";

const getPointsColorClass = (
  recommendedPoints: number | undefined,
  criterionPoints: number
) => {
  if (recommendedPoints === undefined) return "";
  const percentage = (recommendedPoints / criterionPoints) * 100;
  if (percentage >= 80) return "text-green-400";
  if (percentage >= 60) return "text-yellow-400";
  if (percentage >= 40) return "text-orange-400";
  return "text-red-400";
};
export const AnalysisSummary: FC<{
  criterion: CanvasRubricCriterion;
  model?: string;
  recommendedPoints?: number;
  description?: string;
}> = ({ criterion, model, recommendedPoints, description }) => {
  const pointsColorClass = getPointsColorClass(
    recommendedPoints,
    criterion.points
  );

  return (
    <div className="border-l-4 border-l-violet-900/60 rounded-lg ps-2">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm mb-3">
        <div className="font-medium text-blue-300">
          {criterion.description || criterion.long_description}
        </div>
        {recommendedPoints !== undefined && (
          <div className={pointsColorClass}>
            {recommendedPoints} / {criterion.points} pts
          </div>
        )}
        {model && (
          <div className="text-gray-300 bg-gray-700 px-2 py-1 rounded text-xs">
            {model}
          </div>
        )}
      </div>

      {description && (
        <div
          className="
            text-lg text-gray-300 leading-relaxed 
            whitespace-pre-wrap 
            border-t border-gray-700 
            pt-3
          "
        >
          {description}
        </div>
      )}
    </div>
  );
};
