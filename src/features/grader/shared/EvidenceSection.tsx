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
  title?: string;
}> = ({
  evidence,
  assignmentId,
  studentName,
  termName,
  courseName,
  assignmentName,
  title = "Evidence",
}) => {
  if (!evidence || evidence.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h4 className="font-semibold mb-3">{title}</h4>
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
          />
        ))}
      </div>
    </div>
  );
};
