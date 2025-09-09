import { useState } from "react";
import Spinner from "../../../utils/Spinner";
import { useAllEvaluationsQuery } from "../graderHooks";
import type { FullEvaluation } from "../../../server/trpc/routers/rubricAI/rubricAiReportModels";

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
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Analysis Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Criterion:</span>
                  <div className="font-medium">
                    {selectedAnalysis.metadata?.criterionDescription}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Model:</span>
                  <div className="font-medium">
                    {selectedAnalysis.metadata?.model}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Confidence:</span>
                  <div className="font-medium">
                    {selectedAnalysis.evaluation?.confidence}%
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Recommended Points:</span>
                  <div className="font-medium">
                    {selectedAnalysis.evaluation?.recommendedPoints}
                  </div>
                </div>
              </div>
              {selectedAnalysis.evaluation?.description && (
                <div className="mt-4">
                  <span className="text-gray-400">Description:</span>
                  <div className="mt-1 text-sm">
                    {selectedAnalysis.evaluation.description}
                  </div>
                </div>
              )}
            </div>

            {/* Evidence */}
            {selectedAnalysis.evaluation?.evidence &&
              selectedAnalysis.evaluation.evidence.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Evidence</h4>
                  <div className="space-y-3">
                    {selectedAnalysis.evaluation.evidence.map(
                      (evidence, index) => (
                        <div key={index} className="bg-gray-700 rounded p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-sm">
                              {evidence.fileName}
                            </span>
                          </div>
                          {evidence.lineNumbers && (
                            <div className="text-xs text-gray-400 mb-2">
                              Lines {evidence.lineNumbers.start?.line}-
                              {evidence.lineNumbers.end?.line}
                            </div>
                          )}
                          <div className="text-sm">{evidence.description}</div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Conversation History */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold mb-3">AI Conversation</h4>
              <div className="space-y-3 max-h-96 overflow-auto">
                {selectedAnalysis.conversation?.map((message, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded ${
                      message.role === "user"
                        ? "bg-blue-600/20 border-l-4 border-blue-500"
                        : message.role === "assistant"
                        ? "bg-green-600/20 border-l-4 border-green-500"
                        : "bg-gray-700 border-l-4 border-gray-500"
                    }`}
                  >
                    <div className="text-xs text-gray-400 mb-1 capitalize">
                      {message.role}
                    </div>
                    <div className="text-sm">
                      {message.content ? (
                        typeof message.content === "string" ? (
                          message.content.substring(0, 500) +
                          (message.content.length > 500 ? "..." : "")
                        ) : (
                          JSON.stringify(message.content).substring(0, 500)
                        )
                      ) : message.tool_calls ? (
                        <div className="text-gray-400">
                          Tool calls:{" "}
                          {message.tool_calls
                            .map((tc) => tc.function?.name)
                            .join(", ")}
                        </div>
                      ) : (
                        <div className="text-gray-400">No content</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
