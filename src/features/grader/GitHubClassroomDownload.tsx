import { useState } from "react";
import { useGitHubClassroomMutation } from "./graderHooks";
import { GitHubClassroomAssignmentPicker } from "../../components/GitHubClassroomAssignmentPicker";
import { useCurrentCourse } from "../../components/contexts/CourseProvider";
import { useCurrentAssignment } from "../../components/contexts/AssignmentProvider";
import { useSettingsQuery } from "../home/settingsHooks";
import { Modal } from "../../components/Modal";

export const GitHubClassroomDownload = () => {
  const { courseId, courseName, termName } = useCurrentCourse();
  const { assignmentId, assignmentName } = useCurrentAssignment();
  const { data: settings } = useSettingsQuery();
  const courseSettings = settings?.courses.find((c) => c.canvasId === courseId);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  const gitHubClassroomMutation = useGitHubClassroomMutation();

  const handleGitHubDownload = (onClose: () => void) => {
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

    onClose();
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
        <Modal
          Button={({ onClick }) => (
            <button
              onClick={onClick}
              disabled={gitHubClassroomMutation.isPending}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors"
            >
              GitHub Classroom
            </button>
          )}
          title="GitHub Classroom Integration"
        >
          {({ onClose }) => (
            <div className="space-y-4">
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
                  onClick={onClose}
                  className="px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleGitHubDownload(onClose)}
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
          )}
        </Modal>
      </div>
    </>
  );
};
