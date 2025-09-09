import { useState } from "react";
import { useGitHubClassroomMutation } from "./graderHooks";
import type { SettingsCourse } from "../../server/trpc/routers/settingsRouter";

interface GitHubClassroomDownloadProps {
  courseId: number;
  assignmentId: number;
  course: SettingsCourse | undefined;
}

export const GitHubClassroomDownload: React.FC<
  GitHubClassroomDownloadProps
> = ({ courseId, assignmentId, course }) => {
  const [gitHubClassroomInput, setGitHubClassroomInput] = useState("");
  const [isGitHubPanelOpen, setIsGitHubPanelOpen] = useState(false);

  const gitHubClassroomMutation = useGitHubClassroomMutation();

  const handleGitHubDownload = () => {
    if (!gitHubClassroomInput.trim()) return;

    // Parse GitHub Classroom assignment ID from input
    let classroomAssignmentId = gitHubClassroomInput.trim();

    // If it's a full gh command, extract the assignment ID
    const commandMatch = gitHubClassroomInput.match(
      /gh classroom clone student-repos -a (\d+)/
    );
    if (commandMatch) {
      classroomAssignmentId = commandMatch[1];
    } else if (!/^\d+$/.test(classroomAssignmentId)) {
      // If it's not a pure number, try to extract any number from it
      const numberMatch = gitHubClassroomInput.match(/(\d+)/);
      if (numberMatch) {
        classroomAssignmentId = numberMatch[1];
      } else {
        console.error(
          "Could not parse assignment ID from input:",
          gitHubClassroomInput
        );
        return;
      }
    }

    // Call the tRPC mutation
    gitHubClassroomMutation.mutate({
      classroomAssignmentId,
      assignmentId,
      courseId,
      githubUserMap: course?.githubUserMap || [],
    });

    // Close the panel immediately to show progress
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
              <div>
                <label
                  htmlFor="github-url"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  GitHub Classroom Assignment
                </label>
                <input
                  id="github-url"
                  type="text"
                  value={gitHubClassroomInput}
                  onChange={(e) => setGitHubClassroomInput(e.target.value)}
                  placeholder="730769 or gh classroom clone student-repos -a 730769"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="text-xs text-gray-400">
                <p>
                  Enter either the assignment ID (e.g., 730769) or the full
                  GitHub CLI command.
                </p>
                <p className="mt-1">
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
                    !gitHubClassroomInput.trim() ||
                    gitHubClassroomMutation.isPending
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
