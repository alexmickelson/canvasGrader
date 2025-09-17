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
  // Get the first range for display (if multiple ranges exist)

  return (
    <div className=" bg-gray-900/50 border border-gray-700 rounded">
      <Expandable
        ExpandableElement={({ isExpanded, setIsExpanded }) => (
          <div
            className="flex flex-row justify-between cursor-pointer p-1"
            role="button"
            onClick={() => setIsExpanded((e) => !e)}
          >
            <div>
              <div className="text-slate-400 text-sm">{evidence.fileName}</div>
              <div className="">{evidence.description}</div>
            </div>
            <ExpandIcon
              style={{
                ...(isExpanded ? { rotate: "-90deg" } : {}),
              }}
            />
          </div>
        )}
      >
        {/* File content display */}
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
      </Expandable>
    </div>
  );
};
