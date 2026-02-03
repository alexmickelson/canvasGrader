import type { FC } from "react";
import { useRubricQuery } from "../graderHooks";
import { AnalysisSummary } from "./AnalysisSummary";
import { EvidenceSection } from "./EvidenceSection";
import { ConversationHistory } from "./ConversationHistory";
import type { FullEvaluation } from "../../../server/trpc/routers/rubricAI/rubricAiReportModels";

export const AiCriterionAnalysisDisplay: FC<{
  assignmentId: number;
  assignmentName: string;
  courseName: string;
  termName: string;
  studentName: string;
  evaluation: FullEvaluation;
  submissionId: number;
}> = ({
  assignmentId,
  assignmentName,
  courseName,
  termName,
  studentName,
  evaluation,
  submissionId,
}) => {
  const { data: rubric } = useRubricQuery(assignmentId);

  const criterion =
    !rubric || !evaluation?.metadata.criterionId
      ? null
      : rubric.data.find(
          (crit) => crit.id === evaluation.metadata.criterionId,
        ) || null;

  return (
    <div className="space-y-2  h-full overflow-y-auto">
      <h2 className="unstyled text-gray-400 text-lg">
        Analysis: {evaluation.fileName}
      </h2>
      {criterion ? (
        <AnalysisSummary
          criterion={criterion}
          model={evaluation.metadata.model}
          recommendedPoints={evaluation.evaluation.recommendedPoints}
          description={evaluation.evaluation.description}
        />
      ) : (
        <div className="text-sm text-yellow-400">
          Criterion with ID {evaluation?.metadata.criterionId} not found in
          rubric.
        </div>
      )}

      <EvidenceSection
        evidence={evaluation.evaluation.evidence}
        assignmentId={assignmentId}
        assignmentName={assignmentName}
        studentName={studentName}
        termName={termName}
        courseName={courseName}
        submissionId={submissionId}
      />

      <ConversationHistory conversation={evaluation.conversation} />
    </div>
  );
};
