import type { FC } from "react";
import { useMemo, useState } from "react";
import { useAllEvaluationsQuery, useAiAnalysisMutation } from "../graderHooks";
import { AnalysisSummary } from "./AnalysisSummary";
import { EvidenceSection } from "./EvidenceSection";
import { ConversationHistory } from "./ConversationHistory";
import Spinner from "../../../utils/Spinner";
import type {
  AnalyzeRubricCriterionResponse,
} from "../../../server/trpc/routers/rubricAI/rubricAiReportModels";

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

  // State for live analysis results
  const [analysisResult, setAnalysisResult] =
    useState<AnalyzeRubricCriterionResponse | null>(null);

  // Live AI analysis mutation
  const liveAnalysisMutation = useAiAnalysisMutation();

  const handleRunAnalysis = async () => {
    if (!isLiveAnalysisMode) return;

    try {
      const data = await liveAnalysisMutation.mutateAsync({
        courseId: courseId!,
        assignmentId,
        studentName,
        criterionDescription: criterionDescription!,
        criterionPoints: criterionPoints!,
        criterionId,
        termName,
        courseName,
        assignmentName,
      });
      setAnalysisResult(data);
    } catch (error) {
      // Error is handled by the mutation state
      console.error("Analysis failed:", error);
    }
  };

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
    // Show loading state during mutation
    if (liveAnalysisMutation.isPending) {
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

    // Show error state
    if (liveAnalysisMutation.isError) {
      return (
        <div className="space-y-4">
          <button
            onClick={handleRunAnalysis}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            Run AI Analysis
          </button>
          <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
            <h4 className="font-medium text-red-300 mb-2">Analysis Error</h4>
            <p className="text-sm text-red-400">
              {liveAnalysisMutation.error?.message ||
                "Failed to analyze criterion"}
            </p>
          </div>
        </div>
      );
    }

    // Show analysis results if we have them
    if (analysisResult) {
      const { analysis } = analysisResult;

      return (
        <div className="space-y-4">
          <button
            onClick={handleRunAnalysis}
            disabled={liveAnalysisMutation.isPending}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            Run New Analysis
          </button>

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
        </div>
      );
    }

    // Show initial button to start analysis
    return (
      <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
        <button
          onClick={handleRunAnalysis}
          disabled={liveAnalysisMutation.isPending}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          Run AI Analysis
        </button>
        <p className="text-sm text-gray-400 mt-2">
          Click to analyze this submission against the criterion.
        </p>
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
          <span className="text-sm font-semibold text-gray-200 mb-2">
            {selectedAnalysis.fileName}
          </span>
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
