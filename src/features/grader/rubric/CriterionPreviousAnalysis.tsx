import type { FC } from "react";
import { useAllEvaluationsQuery } from "../graderHooks";
import type { FullEvaluation } from "../../../server/trpc/routers/rubricAI/rubricAiReportModels";
import type { CanvasRubricCriterion } from "../../../server/trpc/routers/canvas/canvasModels";
import Spinner from "../../../utils/Spinner";
import { useViewingItem } from "../shared/viewingItemContext/ViewingItemContext";

export const CriterionPreviousAnalysis: FC<{
  criterion: CanvasRubricCriterion;
  assignmentId: number;
  assignmentName: string;
  courseName: string;
  termName: string;
  studentName: string;
}> = ({
  criterion,
  assignmentId,
  assignmentName,
  courseName,
  termName,
  studentName,
}) => {
  const { data: allEvaluations, isLoading } = useAllEvaluationsQuery({
    assignmentId,
    assignmentName,
    courseName,
    termName,
    studentName,
  });

  // Filter evaluations for this specific criterion
  const criterionEvaluations =
    allEvaluations?.filter((evaluation) =>
      evaluation.fileName.includes(`rubric.${criterion.id}-`)
    ) ?? [];

  if (criterionEvaluations.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 border-t border-gray-600 pt-2">
      <div className="mt-2 space-y-1">
        {isLoading ? (
          <div className="flex justify-center py-2">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-500 mb-2 px-1">
              Click to view analysis:
            </div>
            {criterionEvaluations.map((evaluation, index) => (
              <AnalysisItem
                key={evaluation.filePath}
                evaluation={evaluation}
                index={index}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

const AnalysisItem: FC<{
  evaluation: FullEvaluation;
  index: number;
}> = ({ evaluation, index }) => {
  const { setViewingAnalysis } = useViewingItem();
  const analysis = evaluation.evaluation;

  // Format timestamp from filename or metadata
  const timestamp =
    evaluation.metadata.timestamp ||
    evaluation.fileName.split("-").pop()?.replace(".json", "") ||
    "Unknown";

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(parseInt(ts));
      return date.toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <button
      onClick={() => setViewingAnalysis(evaluation.fileName)}
      className={
        "unstyled cursor-pointer w-full" +
        " bg-gray-800/50 rounded p-3 text-sm" +
        " hover:bg-gray-700/50 transition-colors " +
        "text-left "
      }
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-gray-300 font-medium hover:text-blue-300 flex items-center gap-1">
            Analysis #{index + 1}
            <span className="text-xs text-gray-500">→</span>
          </div>
          <div className="text-xs text-gray-400">
            {formatTimestamp(timestamp)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-green-300">
            {analysis.recommendedPoints} pts
          </div>
        
        </div>
      </div>
    </button>
  );
};
