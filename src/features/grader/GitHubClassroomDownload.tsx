import { useState } from "react";
import { useGitHubClassroomMutation } from "./graderHooks";
import { GitHubClassroomAssignmentPicker } from "../../components/GitHubClassroomAssignmentPicker";
import { useCurrentCourse } from "../../components/contexts/CourseProvider";
import { useCurrentAssignment } from "../../components/contexts/AssignmentProvider";
import { useSettingsQuery } from "../home/settingsHooks";

export const GitHubClassroomDownload = () => {
  const { courseId, courseName, termName } = useCurrentCourse();
  const { assignmentId, assignmentName } = useCurrentAssignment();
  const { data: settings } = useSettingsQuery();
  const courseSettings = settings?.courses.find((c) => c.canvasId === courseId);

  const [isGitHubPanelOpen, setIsGitHubPanelOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);


  const gitHubClassroomMutation = useGitHubClassroomMutation();

  const handleGitHubDownload = () => {
    if (!selectedAssignmentId) return;

    gitHubClassroomMutation.mutate({
      classroomAssignmentId: selectedAssignmentId,
      assignmentId,
      courseId,
      githubUserMap: courseSettings?.githubUserMap || [],
      termName,
      courseName,
      assignmentName,
    });

    setIsGitHubPanelOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {/* GitHub download progress indicator */}
        {gitHubClassroomMutation.isPending && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-md text-blue-300 text-sm">
            <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
            Downloading GitHub Classroom repositories...
          </div>
        )}

        {/* GitHub Classroom Integration Button */}
        <button
          onClick={() => setIsGitHubPanelOpen(true)}
          disabled={gitHubClassroomMutation.isPending}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors"
        >
          GitHub Classroom
        </button>
      </div>

      {/* GitHub Classroom Panel */}
      {isGitHubPanelOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold">
                GitHub Classroom Integration
              </h2>
              <button
                onClick={() => setIsGitHubPanelOpen(false)}
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
              {/* GitHub Classroom Assignment Picker */}
              <GitHubClassroomAssignmentPicker
                selectedAssignmentId={selectedAssignmentId}
                onAssignmentSelect={setSelectedAssignmentId}
              />

              <div className="text-xs text-gray-400">
                <p>
                  This will download all student repositories and organize them
                  into submission folders.
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsGitHubPanelOpen(false)}
                  className="px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGitHubDownload}
                  disabled={
                    !selectedAssignmentId || gitHubClassroomMutation.isPending
                  }
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {gitHubClassroomMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Downloading...
                    </>
                  ) : (
                    "Download & Organize"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
