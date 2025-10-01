import type { FC } from "react";
import type { FullEvaluation } from "../../../server/trpc/routers/rubricAI/rubricAiReportModels";
import { useViewingItem } from "../shared/viewingItemContext/ViewingItemContext";

export const AnalysisItem: FC<{
  evaluation: FullEvaluation;
}> = ({ evaluation }) => {
  const { setViewingAnalysis, viewingItem } = useViewingItem();
  const analysis = evaluation.evaluation;
  const isSelected =
    viewingItem?.type === "analysis" &&
    viewingItem?.name === evaluation.fileName;

  return (
    <div className="w-full flex justify-end">
      <button
        onClick={() => setViewingAnalysis(evaluation.fileName)}
        className={
          "unstyled cursor-pointer " +
          "rounded px-2 py-1 text-sm " +
          "transition-colors flex " +
          (isSelected
            ? "bg-indigo-900/70  "
            : "bg-gray-800/50 hover:bg-gray-700/50 ")
        }
      >
        <div
          className={
            "truncate max-w-40 " +
            (isSelected
              ? "text-indigo-200 hover:text-indigo-100"
              : "text-gray-500 hover:text-gray-300")
          }
        >
          {analysis.description}
        </div>
        <div
          className={
            "font-bold ps-3 " +
            (isSelected ? "text-green-400" : "text-green-600")
          }
        >
          {analysis.recommendedPoints} pts
        </div>
      </button>
    </div>
  );
};
