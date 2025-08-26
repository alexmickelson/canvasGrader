import { useState } from "react";
import { GitHubMappingPanel } from "./GitHubMappingPanel";

export const GitHubMappingPanelWithClassroomId = ({
  courseId,
}: {
  courseId: number;
}) => {
  const [classroomAssignmentId, setClassroomAssignmentId] = useState("");
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  return (
    <div className="mb-4">
      {!submittedId ? (
        <div className="flex items-center gap-2 p-3 bg-gray-900 rounded">
          <input
            value={classroomAssignmentId}
            onChange={(e) => setClassroomAssignmentId(e.target.value)}
            placeholder="Enter Classroom Assignment ID"
            className="p-2 bg-gray-800 text-gray-200 rounded"
          />
          <button
            className="px-3 py-1 bg-blue-700 rounded"
            disabled={!classroomAssignmentId}
            onClick={() => setSubmittedId(classroomAssignmentId)}
          >
            Continue
          </button>
        </div>
      ) : (
        <GitHubMappingPanel
          courseId={courseId}
          classroomAssignmentId={submittedId || ""}
        />
      )}
    </div>
  );
};
