import type { FC } from "react";
import { useAiAnalysisQuery } from "../graderHooks";
import Spinner from "../../../utils/Spinner";
import { EvidenceItem } from "./EvidenceItem";

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

  return (
    <div className="p-4 bg-purple-900/20 border border-purple-700 rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-purple-300">AI Analysis</h4>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            Confidence: {analysisQuery.data.confidence}%
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h5 className="text-sm font-medium text-purple-300">
          Recommended Score
        </h5>
        <div className="text-lg font-bold text-green-400">
          {analysisQuery.data.recommendedPoints} / {criterionPoints} pts
        </div>
      </div>

      <div className="space-y-2">
        <h5 className="text-sm font-medium text-purple-300">Description</h5>
        <p className="text-sm text-gray-300 whitespace-pre-wrap">
          {analysisQuery.data.description}
        </p>
      </div>

      {analysisQuery.data.evidence.length > 0 && (
        <div className="space-y-2">
          <h6 className="text-purple-300  ">Evidence</h6>
          {analysisQuery.data.evidence.map((evidence, index) => (
            <EvidenceItem
              key={index}
              evidence={evidence}
              assignmentId={assignmentId}
              studentName={studentName}
              termName={termName}
              courseName={courseName}
              assignmentName={assignmentName}
            />
          ))}
        </div>
      )}
    </div>
  );
};
