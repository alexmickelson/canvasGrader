import { useState } from "react";
import Spinner from "../../../utils/Spinner";
import { useAllEvaluationsQuery } from "../graderHooks";
import type { FullEvaluation } from "../../../server/trpc/routers/rubricAI/rubricAiReportModels";
import { AnalysisSummary } from "../shared/AnalysisSummary";
import { EvidenceSection } from "../shared/EvidenceSection";
import { ConversationHistory } from "../shared/ConversationHistory";

export const AnalysisView: React.FC<{
  assignmentId: number;
  assignmentName: string;
  courseName: string;
  termName: string;
  studentName: string;
}> = ({ assignmentId, assignmentName, courseName, termName, studentName }) => {
  const { data: allEvaluations, isLoading } = useAllEvaluationsQuery({
    assignmentId,
    assignmentName,
    courseName,
    termName,
    studentName,
  });

  const [selectedAnalysis, setSelectedAnalysis] =
    useState<FullEvaluation | null>(null);

  if (!allEvaluations)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Analysis Selection */}
      <div className="flex-shrink-0 border-b border-gray-700 p-4">
        <h3 className="text-lg font-semibold mb-3">Previous AI Analyses</h3>
        <div className="space-y-2">
          {allEvaluations.map((analysis) => (
            <button
              key={analysis.fileName}
              onClick={() => setSelectedAnalysis(analysis)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedAnalysis?.fileName === analysis.fileName
                  ? "bg-blue-600/20 border-blue-500 text-blue-300"
                  : "bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {analysis.metadata?.criterionDescription ||
                      "Unknown Criterion"}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {analysis.metadata?.timestamp
                      ? new Date(analysis.metadata.timestamp).toLocaleString()
                      : "Unknown time"}
                  </div>
                </div>
                <div className="ml-2 text-xs">
                  {analysis.evaluation?.confidence !== undefined && (
                    <span className="px-2 py-1 bg-gray-700 rounded">
                      {analysis.evaluation.confidence}% confidence
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Analysis Details */}
      <div className="flex-1 min-h-0 overflow-auto">
        {selectedAnalysis ? (
          <div className="p-4 space-y-6">
            <AnalysisSummary
              criterionDescription={
                selectedAnalysis.metadata?.criterionDescription
              }
              model={selectedAnalysis.metadata?.model}
              confidence={selectedAnalysis.evaluation?.confidence}
              recommendedPoints={selectedAnalysis.evaluation?.recommendedPoints}
              description={selectedAnalysis.evaluation?.description}
              timestamp={selectedAnalysis.metadata?.timestamp}
            />

            <EvidenceSection
              evidence={selectedAnalysis.evaluation?.evidence ?? []}
              assignmentId={assignmentId}
              studentName={studentName}
              termName={termName}
              courseName={courseName}
              assignmentName={assignmentName}
            />

            <ConversationHistory
              conversation={selectedAnalysis.conversation || []}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-lg mb-2">Select an Analysis</div>
              <div className="text-sm">
                Choose an analysis from the list above to view details.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
