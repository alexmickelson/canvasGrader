import type { FC } from "react";
import type { CanvasRubricCriterion } from "../../../server/trpc/routers/canvas/canvasModels";

export const AnalysisSummary: FC<{
  criterion: CanvasRubricCriterion;
  model?: string;
  recommendedPoints?: number;
  description?: string;
}> = ({ criterion, model, recommendedPoints, description }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm mb-3">
        <div className="font-medium text-blue-300">
          {criterion.description || criterion.long_description}
        </div>
        {recommendedPoints !== undefined && (
          <div
            className={`
            ${(() => {
              const percentage = (recommendedPoints / criterion.points) * 100;
              if (percentage >= 80) return "text-green-400";
              if (percentage >= 60) return "text-yellow-400";
              if (percentage >= 40) return "text-orange-400";
              return "text-red-400";
            })()}
          `}
          >
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
        <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap border-t border-gray-700 pt-3">
          {description}
        </div>
      )}
    </div>
  );
};
