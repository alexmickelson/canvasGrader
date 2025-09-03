import type { FC } from "react";
import { SubmissionFileExplorer } from "../../../utils/SubmissionFileExplorer";

export const SubmissionFileExplorerComponent: FC<{
  assignmentId: number;
  assignmentName: string;
  studentName: string;
  termName: string;
  courseName: string;
  className?: string;
}> = ({
  assignmentId,
  assignmentName,
  studentName,
  termName,
  courseName,
  className = "",
}) => {
  return (
    <div
      className={`bg-gray-900 border border-gray-700 rounded-lg p-4 ${className}`}
    >
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-3">
        Student Submission Explorer
      </div>

      <SubmissionFileExplorer
        assignmentId={assignmentId}
        assignmentName={assignmentName}
        studentName={studentName}
        termName={termName}
        courseName={courseName}
        className={className}
      />

      <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-500">
        Browse and preview all files in the student's submission folder. Click
        on any file to view its contents.
      </div>
    </div>
  );
};
