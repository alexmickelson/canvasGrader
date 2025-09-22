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

  // Sort by timestamp (newer first, older later)
  const sortedEvaluations = criterionEvaluations.sort((a, b) => {
    const getTimestamp = (evaluation: FullEvaluation) => {
      if (evaluation.metadata.timestamp) {
        return new Date(evaluation.metadata.timestamp).getTime();
      }
      // Fallback to extracting from filename if needed
      const filenameTimestamp =
        evaluation.fileName.split("-").pop()?.replace(".json", "") || "0";
      return parseInt(filenameTimestamp);
    };

    return getTimestamp(b) - getTimestamp(a); // Descending order (newer first)
  });

  if (sortedEvaluations.length === 0) {
    return null;
  }

  return (
    <div className=" ps-3 mt-2 space-y-1">
      {isLoading ? (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      ) : (
        <>
          {sortedEvaluations.map((evaluation) => (
            <AnalysisItem key={evaluation.filePath} evaluation={evaluation} />
          ))}
        </>
      )}
    </div>
  );
};

const AnalysisItem: FC<{
  evaluation: FullEvaluation;
}> = ({ evaluation }) => {
  const { setViewingAnalysis } = useViewingItem();
  const analysis = evaluation.evaluation;

  return (
    <div className="w-full flex justify-end">
      <button
        onClick={() => setViewingAnalysis(evaluation.fileName)}
        className={
          "unstyled cursor-pointer" +
          " bg-gray-800/50 rounded px-2 py-1 text-sm" +
          " hover:bg-gray-700/50 transition-colors " +
          "flex"
        }
      >
        <div className="text-gray-500 hover:text-gray-300 truncate max-w-80">
          {analysis.description}
        </div>
        <div className=" font-bold text-green-600 ps-3">
          {analysis.recommendedPoints} pts
        </div>
      </button>
    </div>
  );
};
