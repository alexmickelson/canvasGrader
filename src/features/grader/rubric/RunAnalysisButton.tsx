import { useState, type FC } from "react";
import { useAiAnalysisMutation } from "../graderHooks";
import Spinner from "../../../utils/Spinner";
import { useTRPCClient } from "../../../server/trpc/trpcClient";

export const RunAnalysisButton: FC<{
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
  const liveAnalysisMutation = useAiAnalysisMutation();
  const [status, setStatus] = useState("");
   const trpcClient = useTRPCClient();

  return (
    <button
      onClick={() =>
      {
        // tr
        liveAnalysisMutation.mutate({
          courseId,
          assignmentId,
          studentName,
          criterionDescription,
          criterionPoints,
          criterionId,
          termName,
          courseName,
          assignmentName,
        })
      }
      }
      disabled={liveAnalysisMutation.isPending}
      className="
        unstyled
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
      {liveAnalysisMutation.isPending && <Spinner size="sm" />}
      {liveAnalysisMutation.isPending ? "Analyzing..." : "Run AI Analysis"}
      {liveAnalysisMutation.isPending && status && (
        <>
          <Spinner /> {status}
        </>
      )}
    </button>
  );
};
