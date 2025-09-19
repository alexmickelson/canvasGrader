import type { FC } from "react";
import { useMemo } from "react";
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
}> = ({
  assignmentId,
  assignmentName,
  courseName,
  termName,
  studentName,
  analysisName,
}) => {
  // Load all evaluations for this student
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
    if (!allEvaluations) return null;

    return (
      allEvaluations.find(
        (evaluation) =>
          evaluation.fileName === analysisName ||
          evaluation.fileName.includes(analysisName) ||
          evaluation.filePath.includes(analysisName)
      ) || null
    );
  }, [allEvaluations, analysisName]);

  // Load rubric data to get criterion details
  const { data: rubric } = useRubricQuery(
    selectedAnalysis?.metadata.courseId || 0,
    assignmentId
  );

  // Find the specific criterion from the rubric
  const criterion = useMemo(() => {
    if (!rubric || !selectedAnalysis?.metadata.criterionId) return null;

    return (
      rubric.data.find(
        (crit) => crit.id === selectedAnalysis.metadata.criterionId
      ) || null
    );
  }, [rubric, selectedAnalysis?.metadata.criterionId]);

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
    <div className="space-y-2 ">
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
