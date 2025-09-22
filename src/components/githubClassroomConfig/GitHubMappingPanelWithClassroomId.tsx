import { useState } from "react";
import { GitHubMappingPanel } from "./GitHubMappingPanel";
import { SuspenseAndError } from "../../utils/SuspenseAndError";
import { GitHubClassroomAssignmentPicker } from "../GitHubClassroomAssignmentPicker";

export const GitHubMappingPanelWithClassroomId = ({
  courseId,
}: {
  courseId: number;
}) => {
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  const handleAssignmentSelect = (assignmentId: string | null) => {
    setSelectedAssignmentId(assignmentId);
  };

  const handleContinue = () => {
    if (selectedAssignmentId) {
      setSubmittedId(selectedAssignmentId);
      setIsPickerOpen(false);
    }
  };

  return (
    <div className="mb-4">
      {!submittedId ? (
        <>
          <button
            onClick={() => setIsPickerOpen(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-medium transition-colors"
          >
            Setup Github Classroom Student Names
          </button>

          {/* Assignment Picker Popup */}
          {isPickerOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                  <h2 className="text-lg font-semibold">
                    Select GitHub Classroom Assignment
                  </h2>
                  <button
                    onClick={() => setIsPickerOpen(false)}
                    className="text-gray-400 hover:text-gray-200 rounded cursor-pointer"
                    aria-label="Close"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  <GitHubClassroomAssignmentPicker
                    selectedAssignmentId={selectedAssignmentId}
                    onAssignmentSelect={handleAssignmentSelect}
                  />

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setIsPickerOpen(false)}
                      className="px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleContinue}
                      disabled={!selectedAssignmentId}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white font-medium transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
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
