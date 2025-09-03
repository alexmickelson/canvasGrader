import type { FC } from "react";
import { useAiAnalysisQuery } from "../graderHooks";
import Spinner from "../../../utils/Spinner";

export const AICriterionAnalysis: FC<{
  courseId: number;
  assignmentId: number;
  studentName: string;
  criterionDescription: string;
  criterionPoints: number;
  criterionId?: string;
  termName: string;
  courseName: string;
  assignmentName: string;
}> = ({
  courseId,
  assignmentId,
  studentName,
  criterionDescription,
  criterionPoints,
  criterionId,
  termName,
  courseName,
  assignmentName,
}) => {
  const analysisQuery = useAiAnalysisQuery({
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

  if (analysisQuery.isLoading) {
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

  if (analysisQuery.isError) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
        <h4 className="font-medium text-red-300 mb-2">Analysis Error</h4>
        <p className="text-sm text-red-400">
          {analysisQuery.error?.message || "Failed to analyze criterion"}
        </p>
      </div>
    );
  }

  if (!analysisQuery.data) {
    return null;
  }

  const analysis = analysisQuery.data;

  return (
    <div className="p-4 bg-purple-900/20 border border-purple-700 rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-purple-300">AI Analysis</h4>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm px-2 py-1 rounded-full ${
              analysis.satisfied
                ? "bg-green-900/50 text-green-300"
                : "bg-red-900/50 text-red-300"
            }`}
          >
            {analysis.satisfied ? "✓ Satisfied" : "✗ Not Satisfied"}
          </span>
          <span className="text-sm text-gray-400">
            Confidence: {analysis.confidence}%
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h5 className="text-sm font-medium text-purple-300">
          Recommended Score
        </h5>
        <div className="text-lg font-bold text-green-400">
          {analysis.recommendedPoints} / {criterionPoints} pts
        </div>
      </div>

      <div className="space-y-2">
        <h5 className="text-sm font-medium text-purple-300">Explanation</h5>
        <p className="text-sm text-gray-300 whitespace-pre-wrap">
          {analysis.explanation}
        </p>
      </div>

      {analysis.evidence.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-purple-300">Evidence</h5>
          <div className="space-y-2">
            {analysis.evidence.map((evidence, index) => (
              <div
                key={index}
                className="p-3 bg-gray-900/50 border border-gray-700 rounded"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-300">
                    📄 {evidence.fileName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        evidence.meetsRequirement
                          ? "bg-green-900/50 text-green-300"
                          : "bg-red-900/50 text-red-300"
                      }`}
                    >
                      {evidence.meetsRequirement ? "Meets" : "Doesn't meet"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {evidence.confidence}%
                    </span>
                  </div>
                </div>

                {evidence.lineNumbers && evidence.lineNumbers.length > 0 && (
                  <div className="text-xs text-gray-400 mb-1">
                    Lines: {evidence.lineNumbers.join(", ")}
                  </div>
                )}

                {evidence.pageNumbers && evidence.pageNumbers.length > 0 && (
                  <div className="text-xs text-gray-400 mb-1">
                    Pages: {evidence.pageNumbers.join(", ")}
                  </div>
                )}

                <div className="text-sm text-gray-300 mb-2">
                  "{evidence.relevantContent}"
                </div>

                <div className="text-xs text-gray-400">
                  {evidence.reasoning}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.additionalFilesNeeded &&
        analysis.additionalFilesNeeded.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-yellow-300">
              Additional Files Needed
            </h5>
            <div className="text-sm text-yellow-400">
              {analysis.additionalFilesNeeded.join(", ")}
            </div>
          </div>
        )}
    </div>
  );
};
