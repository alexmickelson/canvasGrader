import type { FC } from "react";
import { ViewFileComponent } from "../submission/fileViewer/ViewFileComponent";
import { Expandable } from "../../../utils/Expandable";
import ExpandIcon from "../../../utils/ExpandIcon";
import type { Evidence } from "../../../server/trpc/routers/rubricAI/rubricAiReportModels";

export const EvidenceItem: FC<{
  evidence: Evidence;
  assignmentId: number;
  studentName: string;
  termName: string;
  courseName: string;
  assignmentName: string;
}> = ({
  evidence,
  assignmentId,
  studentName,
  termName,
  courseName,
  assignmentName,
}) => {
  return (
    <div className="border-l-4 border-l-violet-900/60 rounded-lg ps-2">
      <div className=" flex-1 flex flex-col min-w-0  mb-2">
        <div className={"text-slate-400 "}>ai comments:</div>
        <div className={"text-slate-300 "}>{evidence.description}</div>
      </div>
      <ViewFileComponent
        assignmentId={assignmentId}
        assignmentName={assignmentName}
        studentName={studentName}
        termName={termName}
        courseName={courseName}
        filePath={evidence.fileName}
        startLine={evidence.lineStart ?? undefined}
        startColumn={undefined}
        endLine={evidence.lineEnd ?? undefined}
        endColumn={undefined}
      />
    </div>
  );
};
