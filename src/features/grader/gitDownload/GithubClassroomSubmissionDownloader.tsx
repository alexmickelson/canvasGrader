import { useCurrentAssignment } from "../../../components/contexts/AssignmentProvider";
import { useCurrentCourse } from "../../../components/contexts/CourseProvider";
import {
  useGithubClassroomAssignmentQuery,
  useDownloadAssignedRepositories,
} from "../../../components/githubClassroomConfig/githubMappingHooks";
import { Modal } from "../../../components/Modal";
import { AssignedGithubClassroomStudentGitRepositoriesList } from "./AssignedGithubClassroomStudentGitRepositoriesList";
import { SuspenseAndError } from "../../../utils/SuspenseAndError";
import { OtherGitRepoStudentAssignments } from "./OtherGitRepoStudentAssignments";
import Spinner from "../../../utils/Spinner";
import { ClassroomAndAssignmentFromGithubAssignmentCoordinator } from "./ClassroomAndAssignmentFromGithubAssignmentCoordinator";

export const GithubClassroomSubmissionDownloader = () => {
  const { courseId } = useCurrentCourse();
  const { assignmentId } = useCurrentAssignment();

  const {
    data: { githubClassroomAssignment },
  } = useGithubClassroomAssignmentQuery(assignmentId);

  const downloadMutation = useDownloadAssignedRepositories();

  return (
    <Modal
      title="Download Git Repos"
      width="4xl"
      Button={({ onClick }) => (
        <button
          onClick={onClick}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors"
        >
          New GitHub Classroom
        </button>
      )}
    >
      {({ onClose }) => {
        return (
          <SuspenseAndError>
            <div>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <ClassroomAndAssignmentFromGithubAssignmentCoordinator />

              <div>
                <button
                  className="unstyled px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm disabled:opacity-50 mb-3 flex items-center gap-2"
                  onClick={() =>
                    downloadMutation.mutate({ assignmentId, courseId })
                  }
                  disabled={downloadMutation.isPending}
                >
                  Download Assigned Repositories
                  {downloadMutation.isPending && <Spinner />}
                </button>
                {downloadMutation.isSuccess && (
                  <div className="mb-3 p-3 bg-green-900/30 border border-green-700 rounded text-sm">
                    <div className="text-green-400 font-medium">
                      Download Complete
                    </div>
                    <div className="text-gray-300 mt-1">
                      Successful: {downloadMutation.data.successful} / Failed:{" "}
                      {downloadMutation.data.failed}
                    </div>
                  </div>
                )}
                {downloadMutation.isError && (
                  <div className="mb-3 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-400">
                    Error: {downloadMutation.error.message}
                  </div>
                )}
              </div>

              <div>
                {githubClassroomAssignment ? (
                  <div>
                    <AssignedGithubClassroomStudentGitRepositoriesList
                      githubClassroomAssignment={githubClassroomAssignment}
                    />
                  </div>
                ) : (
                  <OtherGitRepoStudentAssignments />
                )}
              </div>
            </div>
          </SuspenseAndError>
        );
      }}
    </Modal>
  );
};
