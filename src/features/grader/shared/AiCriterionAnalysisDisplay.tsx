import type { FC } from "react";
import { useMemo } from "react";
import { useAllEvaluationsQuery, useAiAnalysisQuery } from "../graderHooks";
import { AnalysisSummary } from "./AnalysisSummary";
import { EvidenceSection } from "./EvidenceSection";
import { ConversationHistory } from "./ConversationHistory";
import Spinner from "../../../utils/Spinner";

export const AiCriterionAnalysisDisplay: FC<{
  // Common props
  assignmentId: number;
  assignmentName: string;
  courseName: string;
  termName: string;
  studentName: string;

  // For live AI analysis mode
  courseId?: number;
  criterionDescription?: string;
  criterionPoints?: number;
  criterionId?: string;

  // For viewing existing analysis mode
  analysisName?: string;
}> = ({
  assignmentId,
  assignmentName,
  courseName,
  termName,
  studentName,
  courseId,
  criterionDescription,
  criterionPoints,
  criterionId,
  analysisName,
}) => {
  // Determine which mode we're in
  const isLiveAnalysisMode =
    !analysisName && courseId && criterionDescription && criterionPoints;
  const isViewingExistingMode = !!analysisName;

  // Live AI analysis query - only call when we have all required parameters
  const liveAnalysisQuery = useAiAnalysisQuery({
    courseId,
    assignmentId,
    studentName,
    criterionDescription,
    criterionPoints,
    criterionId,
    termName,
    courseName,
    assignmentName,
  });

  // Existing analysis query
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
    if (!isViewingExistingMode || !allEvaluations) return null;

    return (
      allEvaluations.find(
        (evaluation) =>
          evaluation.fileName === analysisName ||
          evaluation.fileName.includes(analysisName!) ||
          evaluation.filePath.includes(analysisName!)
      ) || null
    );
  }, [allEvaluations, analysisName, isViewingExistingMode]);

  // Handle live analysis mode
  if (isLiveAnalysisMode) {
    if (liveAnalysisQuery.isLoading) {
      return (
        <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Spinner size="sm" />
            <span className="text-blue-300 font-medium">
              Analyzing submission...
            </span>
          </div>
          <p className="text-sm text-gray-400">
            AI is examining the submission files against this criterion.
          </p>
        </div>
      );
    }

    if (liveAnalysisQuery.isError) {
      return (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
          <h4 className="font-medium text-red-300 mb-2">Analysis Error</h4>
          <p className="text-sm text-red-400">
            {liveAnalysisQuery.error?.message || "Failed to analyze criterion"}
          </p>
        </div>
      );
    }

    if (!liveAnalysisQuery.data) {
      return null;
    }

    const { analysis } = liveAnalysisQuery.data;

    return (
      <div className="p-4 bg-purple-900/20 border border-purple-700 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              Confidence: {analysis.confidence}%
            </span>
          </div>
        </div>

        <AnalysisSummary
          confidence={analysis.confidence}
          recommendedPoints={analysis.recommendedPoints}
          totalPoints={criterionPoints}
          description={analysis.description}
        />

        <EvidenceSection
          evidence={analysis.evidence}
          assignmentId={assignmentId}
          studentName={studentName}
          termName={termName}
          courseName={courseName}
          assignmentName={assignmentName}
          title="Evidence"
        />
      </div>
    );
  }

  // Handle viewing existing analysis mode
  if (isViewingExistingMode) {
    if (evaluationsLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      );
    }

    if (!allEvaluations) {
      return (
        <div className="text-center text-gray-400 p-8">
          No evaluations found
        </div>
      );
    }

    if (!selectedAnalysis) {
      return (
        <div className="text-center text-gray-400 p-8">
          Analysis "{analysisName}" not found
          <div className="text-sm text-gray-500 mt-2">
            Available analyses:{" "}
            {allEvaluations.map((e) => e.fileName).join(", ")}
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
  }

  // Fallback - no valid mode
  return (
    <div className="text-center text-gray-400 p-8">
      Invalid analysis configuration
    </div>
  );
};
