import { useState } from "react";
import type { FormEvent } from "react";
import { GitHubMappingPanel } from "./GitHubMappingPanel";
import { SuspenseAndError } from "../../../utils/SuspenseAndError";

export const GitHubMappingPanelWithClassroomId = ({
  courseId,
}: {
  courseId: number;
}) => {
  const [classroomAssignmentId, setClassroomAssignmentId] = useState("");
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  console.log("Submitted ID:", submittedId);

  return (
    <div className="mb-4">
      {!submittedId ? (
        <form
          className="flex items-center gap-2 p-3 bg-gray-900 rounded"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!classroomAssignmentId) return;
            setSubmittedId(classroomAssignmentId);
          }}
        >
          <input
            value={classroomAssignmentId}
            onChange={(e) => setClassroomAssignmentId(e.target.value)}
            placeholder="Enter Classroom Assignment ID"
            className="p-2 bg-gray-800 text-gray-200 rounded"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-blue-700 rounded"
            disabled={!classroomAssignmentId}
          >
            Continue
          </button>
        </form>
      ) : (
        <SuspenseAndError>
          {submittedId && (
            <GitHubMappingPanel
              courseId={courseId}
              classroomAssignmentId={submittedId}
            />
          )}
        </SuspenseAndError>
      )}
    </div>
  );
};
