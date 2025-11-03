import { useState, type FC } from "react";
import { useAiAnalysisMutation, useRubricQuery } from "../graderHooks";
import Spinner from "../../../utils/Spinner";

export const RunAllAnalysis: FC<{
  courseId: number;
  assignmentId: number;
  studentName: string;
  termName: string;
  courseName: string;
  assignmentName: string;
}> = ({
  courseId,
  assignmentId,
  studentName,
  termName,
  courseName,
  assignmentName,
}) => {
  const aiAnalysisMutation = useAiAnalysisMutation();
  const { data: rubric, isLoading: rubricLoading } = useRubricQuery(
    assignmentId
  );
  const [runningCount, setRunningCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const handleRunAllAnalysis = async () => {
    if (!rubric || !rubric.data) {
      console.error("No rubric data available");
      return;
    }

    const criteria = rubric.data;
    setRunningCount(criteria.length);
    setCompletedCount(0);

    // Run all analyses concurrently
    const analysisPromises = criteria.map(async (criterion) => {
      try {
        await aiAnalysisMutation.mutateAsync({
          courseId,
          assignmentId,
          studentName,
          criterionDescription:
            criterion.description ||
            criterion.long_description ||
            `Criterion ${criterion.id}`,
          criterionPoints: criterion.points,
          criterionId: criterion.id,
          termName,
          courseName,
          assignmentName,
        });
        setCompletedCount((prev) => prev + 1);
      } catch (error) {
        console.error(`Failed to analyze criterion ${criterion.id}:`, error);
        setCompletedCount((prev) => prev + 1);
      }
    });

    // Wait for all analyses to complete
    await Promise.allSettled(analysisPromises);
    setRunningCount(0);
  };

  const isRunning = runningCount > 0;
  const progressPercent =
    runningCount > 0 ? (completedCount / runningCount) * 100 : 0;

  return (
    <button
      onClick={handleRunAllAnalysis}
      disabled={isRunning || rubricLoading || !rubric || !rubric.data?.length}
      className="
        unstyled
        relative overflow-hidden
        px-4 py-2
        bg-purple-900 hover:bg-purple-700 disabled:bg-purple-800
        border border-purple-600
        disabled:cursor-not-allowed
        text-purple-200
        rounded
        font-medium
        transition-colors
        flex items-center gap-2
      "
    >
      {/* Progress bar */}
      {isRunning && (
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-purple-100 transition-all duration-500"
          style={{ width: `${Math.max(progressPercent, 5)}%` }}
        />
      )}

      {isRunning && <Spinner size="sm" />}
      {rubricLoading
        ? "Loading Rubric..."
        : isRunning
        ? "Analyzing..."
        : `Analyze Each Rubric Item`}
    </button>
  );
};
