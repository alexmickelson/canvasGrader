import type { FC } from "react";
import { EvidenceItem } from "./EvidenceItem";
import type { Evidence } from "../../../server/trpc/routers/rubricAI/rubricAiReportModels";

export const EvidenceSection: FC<{
  evidence: Evidence[];
  assignmentId: number;
  studentName: string;
  termName: string;
  courseName: string;
  assignmentName: string;
  submissionId: number;
}> = ({
  evidence,
  assignmentId,
  studentName,
  termName,
  courseName,
  assignmentName,
  submissionId,
}) => {
  return (
    <div className="space-y-3">
      {evidence.map((evidenceItem, index) => (
        <EvidenceItem
          key={index}
          evidence={evidenceItem}
          assignmentId={assignmentId}
          studentName={studentName}
          termName={termName}
          courseName={courseName}
          assignmentName={assignmentName}
          submissionId={submissionId}
        />
      ))}
    </div>
  );
};
