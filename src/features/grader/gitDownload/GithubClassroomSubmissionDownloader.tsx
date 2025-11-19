import { useCurrentAssignment } from "../../../components/contexts/AssignmentProvider";
import { useCurrentCourse } from "../../../components/contexts/CourseProvider";
import {
  useGithubClassroomAssignmentQuery,
  useDownloadAssignedRepositories,
} from "./githubMappingHooks";
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
          GitHub Classroom
        </button>
      )}
    >
      {({ close }) => {
        return (
          <SuspenseAndError>
            <div>
              <ClassroomAndAssignmentFromGithubAssignmentCoordinator />

              <div>
                <button
                  className={" text-sm my-2"}
                  onClick={async () => {
                    const downloadResults = await downloadMutation.mutateAsync({
                      assignmentId,
                      courseId,
                    });
                    if (downloadResults.failed === 0) {
                      close();
                    }
                  }}
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
