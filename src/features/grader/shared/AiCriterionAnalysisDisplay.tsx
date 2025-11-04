import type { FC } from "react";
import { useAllEvaluationsQuery, useRubricQuery } from "../graderHooks";
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
  submissionId: number;
}> = ({
  assignmentId,
  assignmentName,
  courseName,
  termName,
  studentName,
  analysisName,
  submissionId,
}) => {
  const { data: allEvaluations, isLoading: evaluationsLoading } =
    useAllEvaluationsQuery({
      submissionId,
    });

  const selectedAnalysis = allEvaluations?.find(
    (evaluation) =>
      evaluation.fileName === analysisName ||
      evaluation.fileName.includes(analysisName)
  );

  const { data: rubric } = useRubricQuery(assignmentId);

  const criterion =
    !rubric || !selectedAnalysis?.metadata.criterionId
      ? null
      : rubric.data.find(
          (crit) => crit.id === selectedAnalysis.metadata.criterionId
        ) || null;

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
    <div className="space-y-2  h-full overflow-y-auto">
      <h2 className="unstyled text-gray-400 text-lg">
        Analysis: {selectedAnalysis.fileName}
      </h2>
      {criterion ? (
        <AnalysisSummary
          criterion={criterion}
          model={selectedAnalysis.metadata.model}
          recommendedPoints={selectedAnalysis.evaluation.recommendedPoints}
          description={selectedAnalysis.evaluation.description}
        />
      ) : (
        <div className="text-sm text-yellow-400">
          Criterion with ID {selectedAnalysis?.metadata.criterionId} not found
          in rubric.
        </div>
      )}

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
