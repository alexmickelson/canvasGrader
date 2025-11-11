import { useState, type FC } from "react";
import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasModels";
import {
  useAssignedStudentRepositoriesQuery,
  useClassroomAssignmentGitUrlsQuery,
  useGithubStudentUsernames,
} from "../../../components/githubClassroomConfig/githubMappingHooks";
import { StudentGithubUsernameAssignor } from "./StudentGithubUsernameAssignor";

export const SubmissionRepoListItem: FC<{
  submission: CanvasSubmission;
  githubClassroomAssignmentId: number;
}> = ({ submission, githubClassroomAssignmentId }) => {
  const {
    data: { githubRepositories: submissionRepositories },
  } = useAssignedStudentRepositoriesQuery(githubClassroomAssignmentId);

  const { data: githubClassroomRepoUrls } = useClassroomAssignmentGitUrlsQuery(
    githubClassroomAssignmentId
  );

  const { data: studentGithubUsernames } = useGithubStudentUsernames(
    githubClassroomAssignmentId
  );

  const studentRepository = submissionRepositories.find(
    (repo) => repo.user_id === submission.user_id
  );

  const knownCurrentStudentGithubUsername = studentGithubUsernames.find(
    (mapping) => mapping.user_id === submission.user_id
  );

  const githubClassroomRepository = githubClassroomRepoUrls.find((repo) =>
    repo.students.some(
      (githubUsername) =>
        githubUsername === knownCurrentStudentGithubUsername?.github_username
    )
  );

  const [showGithubUsernameSelector, setShowGithubUsernameSelector] =
    useState(false);

  return (
    <div className="mb-3">
      {submission.user.name}
      <div className="flex justify-between">
        <div>
          Github Username:
          <div>
            {knownCurrentStudentGithubUsername?.github_username ?? "none"}
          </div>
          {!knownCurrentStudentGithubUsername?.github_username && (
            <button onClick={() => setShowGithubUsernameSelector(true)}>
              Select Username
            </button>
          )}
        </div>
        <div>
          {studentRepository ? (
            <div>{studentRepository.repo_url}</div>
          ) : (
            <div>repo not assigned</div>
          )}
        </div>
        <div>
          {githubClassroomRepository
            ? githubClassroomRepository.repositoryUrl
            : "no matching repo found"}
        </div>
      </div>
      {showGithubUsernameSelector && (
        <StudentGithubUsernameAssignor
          githubClassroomAssignmentId={githubClassroomAssignmentId}
          canvasUserId={submission.user_id}
        />
      )}
    </div>
  );
};
