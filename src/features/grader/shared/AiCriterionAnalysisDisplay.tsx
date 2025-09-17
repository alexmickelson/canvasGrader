import type { FC } from "react";
import { useMemo } from "react";
import { useAllEvaluationsQuery } from "../graderHooks";
import { AnalysisSummary } from "./AnalysisSummary";
import { EvidenceSection } from "./EvidenceSection";
import { ConversationHistory } from "./ConversationHistory";
import Spinner from "../../../utils/Spinner";

export const AiCriterionAnalysisDisplay: FC<{
  assignmentId: number;
  assignmentName: string;
  courseName: string;
  termName: string;
  studentName: string;
  analysisName: string;
}> = ({
  assignmentId,
  assignmentName,
  courseName,
  termName,
  studentName,
  analysisName,
}) => {
  // Load all evaluations for this student
  const { data: allEvaluations, isLoading: evaluationsLoading } =
    useAllEvaluationsQuery({
      assignmentId,
      assignmentName,
      courseName,
      termName,
      studentName,
    });

  // Find specific analysis for viewing mode
  const selectedAnalysis = useMemo(() => {
    if (!allEvaluations) return null;

    return (
      allEvaluations.find(
        (evaluation) =>
          evaluation.fileName === analysisName ||
          evaluation.fileName.includes(analysisName) ||
          evaluation.filePath.includes(analysisName)
      ) || null
    );
  }, [allEvaluations, analysisName]);

  if (evaluationsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!allEvaluations) {
    return (
      <div className="text-center text-gray-400 p-8">No evaluations found</div>
    );
  }

  if (!selectedAnalysis) {
    return (
      <div className="text-center text-gray-400 p-8">
        Analysis "{analysisName}" not found
        <div className="text-sm text-gray-500 mt-2">
          Available analyses: {allEvaluations.map((e) => e.fileName).join(", ")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b border-gray-700 pb-4">
        <h2 className="text-xl font-semibold text-gray-200 mb-2">
          Analysis: {selectedAnalysis.fileName}
        </h2>
        <div className="text-sm text-gray-400">
          {selectedAnalysis.metadata.timestamp && (
            <span>
              Created:{" "}
              {new Date(selectedAnalysis.metadata.timestamp).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <AnalysisSummary
        confidence={selectedAnalysis.evaluation.confidence}
        recommendedPoints={selectedAnalysis.evaluation.recommendedPoints}
        description={selectedAnalysis.evaluation.description}
        timestamp={selectedAnalysis.metadata.timestamp}
      />

      <EvidenceSection
        evidence={selectedAnalysis.evaluation.evidence}
        assignmentId={assignmentId}
        assignmentName={assignmentName}
        studentName={studentName}
        termName={termName}
        courseName={courseName}
      />

      <ConversationHistory conversation={selectedAnalysis.conversation} />
    </div>
  );
};
