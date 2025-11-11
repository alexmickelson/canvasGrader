import { useState } from "react";
import {
  useLoadGithubClassroomDataQuery,
  useGitHubClassroomAssignmentsQuery,
} from "../features/grader/graderHooks";
import Spinner from "../utils/Spinner";

interface GitHubClassroomAssignmentPickerProps {
  selectedAssignmentId: string | null;
  onAssignmentSelect: (assignmentId: string | null) => void;
  className?: string;
}

export const GitHubClassroomAssignmentPicker: React.FC<
  GitHubClassroomAssignmentPickerProps
> = ({ selectedAssignmentId, onAssignmentSelect, className = "" }) => {
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(
    null
  );

  const classroomsQuery = useLoadGithubClassroomDataQuery();
  const assignmentsQuery = useGitHubClassroomAssignmentsQuery(
    selectedClassroomId || 0
  );

  const handleClassroomSelect = (classroomId: number | null) => {
    setSelectedClassroomId(classroomId);
    onAssignmentSelect(null); // Reset assignment selection
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <div className="block text-sm font-medium text-gray-300 mb-2">
          Classroom:
        </div>
        {classroomsQuery.isLoading ? (
          <div className="flex items-center gap-2 p-2">
            <Spinner size="sm" />
            <span className="text-sm text-gray-400">Loading classrooms...</span>
          </div>
        ) : classroomsQuery.isError ? (
          <div className="text-sm text-red-400 p-2 bg-red-900/20 rounded">
            Failed to load classrooms. Make sure the GitHub CLI is installed and
            authenticated.
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            {classroomsQuery.data?.length === 0 ? (
              <div className="p-3 text-sm text-gray-400 text-center">
                No classrooms found
              </div>
            ) : (
              <div className="space-y-1">
                {classroomsQuery.data?.map((classroom) => (
                  <button
                    key={classroom.id}
                    onClick={() => handleClassroomSelect(classroom.id || null)}
                    className={`unstyled w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedClassroomId === classroom.id
                        ? "bg-purple-600 text-white"
                        : "hover:bg-blue-700 border border-slate-500 rounded"
                    }`}
                  >
                    <div className="font-medium">{classroom.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedClassroomId && (
        <div>
          <div className="block text-sm font-medium text-gray-300 mb-2">
            Select Assignment
          </div>
          {assignmentsQuery.isLoading ? (
            <div className="flex items-center gap-2 p-2">
              <Spinner size="sm" />
              <span className="text-sm text-gray-400">
                Loading assignments...
              </span>
            </div>
          ) : assignmentsQuery.isError ? (
            <div className="text-sm text-red-400 p-2 bg-red-900/20 rounded">
              Failed to load assignments for this classroom.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto ">
              {assignmentsQuery.data?.length === 0 ? (
                <div className="p-3 text-sm text-gray-400 text-center">
                  No assignments found in this classroom
                </div>
              ) : (
                <div className=" p-2 space-y-1">
                  {assignmentsQuery.data?.map((assignment) => (
                    <button
                      key={assignment.id}
                      onClick={() => onAssignmentSelect(assignment.id)}
                      className={`unstyled w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        selectedAssignmentId === assignment.id
                          ? "bg-purple-600 text-white"
                          : "hover:bg-slate-700 border border-slate-500 rounded"
                      }`}
                    >
                      <div className="font-medium">{assignment.title}</div>
                      <div className="text-xs opacity-75">
                        ({assignment.type})
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
