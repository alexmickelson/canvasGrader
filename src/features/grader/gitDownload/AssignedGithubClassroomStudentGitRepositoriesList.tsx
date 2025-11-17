import { useState, type FC } from "react";
import type { GithubClassroomAssignment } from "../../../server/trpc/routers/github/gitModels";
import { useSubmissionsQuery } from "../graderHooks";
import { useCurrentAssignment } from "../../../components/contexts/AssignmentProvider";
import { SuspenseAndError } from "../../../utils/SuspenseAndError";
import {
  useAssignedStudentRepositoriesQuery,
  useClassroomAssignmentGitUrlsQuery,
  useGithubStudentUsernames,
  useSetAssignedStudentRepositoryMutation,
} from "../../../components/githubClassroomConfig/githubMappingHooks";
import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasModels";
import { StudentGithubUsernameAssignor } from "./StudentGithubUsernameAssignor";

export const AssignedGithubClassroomStudentGitRepositoriesList: FC<{
  githubClassroomAssignment: GithubClassroomAssignment;
}> = ({ githubClassroomAssignment }) => {
  const { assignmentId: canvasAssignmentId, assignmentName } =
    useCurrentAssignment();

  const { data: canvasAssignmentSubmissions } = useSubmissionsQuery({
    assignmentId: canvasAssignmentId,
    assignmentName,
  });

  const {
    data: { githubRepositories: submissionRepositories },
  } = useAssignedStudentRepositoriesQuery(canvasAssignmentId);

  const { data: githubClassroomRepoUrls } = useClassroomAssignmentGitUrlsQuery(
    githubClassroomAssignment.github_classroom_assignment_id
  );

  const { data: studentGithubUsernames } = useGithubStudentUsernames();

  const assignRepoMutation = useSetAssignedStudentRepositoryMutation();

  const assignGithubClassroomUrls = () => {
    canvasAssignmentSubmissions.forEach((submission) => {
      const alreadyAssigned = submissionRepositories.some(
        (repo) => repo.user_id === submission.user_id
      );

      if (!alreadyAssigned) {
        const knownGithubUsername = studentGithubUsernames.find(
          (mapping) => mapping.user_id === submission.user_id
        );

        const githubClassroomRepo = githubClassroomRepoUrls.find((repo) =>
          repo.students.some(
            (githubUsername) =>
              githubUsername === knownGithubUsername?.github_username
          )
        );

        if (githubClassroomRepo) {
          assignRepoMutation.mutate({
            assignmentId: canvasAssignmentId,
            repoUrl: githubClassroomRepo.repositoryUrl,
            userId: submission.user_id,
            repoPath: null,
          });
        }
      }
    });
  };

  const unassignedWithReposCount = canvasAssignmentSubmissions.filter(
    (submission) => {
      const alreadyAssigned = submissionRepositories.some(
        (repo) => repo.user_id === submission.user_id
      );
      if (alreadyAssigned) return false;

      const knownGithubUsername = studentGithubUsernames.find(
        (mapping) => mapping.user_id === submission.user_id
      );

      const githubClassroomRepo = githubClassroomRepoUrls.find((repo) =>
        repo.students.some(
          (githubUsername) =>
            githubUsername === knownGithubUsername?.github_username
        )
      );

      return !!githubClassroomRepo;
    }
  ).length;

  return (
    <SuspenseAndError>
      <div>
        {unassignedWithReposCount > 0 && (
          <button
            className="unstyled px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-white text-sm disabled:opacity-50 mb-3"
            onClick={assignGithubClassroomUrls}
            disabled={assignRepoMutation.isPending}
          >
            Assign GitHub Classroom URLs ({unassignedWithReposCount})
          </button>
        )}
        <div className="max-h-[800px] overflow-auto p-2 bg-slate-900">
          {canvasAssignmentSubmissions.map((submission) => (
            <SubmissionRepoListItem
              key={submission.id}
              submission={submission}
              canvasAssignmentId={canvasAssignmentId}
              githubClassroomAssignmentId={
                githubClassroomAssignment.github_classroom_assignment_id
              }
            />
          ))}
        </div>
      </div>
    </SuspenseAndError>
  );
};

export const SubmissionRepoListItem: FC<{
  submission: CanvasSubmission;
  canvasAssignmentId: number;
  githubClassroomAssignmentId: number;
}> = ({ submission, canvasAssignmentId, githubClassroomAssignmentId }) => {
  const {
    data: { githubRepositories: submissionRepositories },
  } = useAssignedStudentRepositoriesQuery(canvasAssignmentId);

  const { data: githubClassroomRepoUrls } = useClassroomAssignmentGitUrlsQuery(
    githubClassroomAssignmentId
  );

  const { data: studentGithubUsernames } = useGithubStudentUsernames();

  const assignRepoMutation = useSetAssignedStudentRepositoryMutation();

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
    <div className="p-3 bg-gray-800 rounded border border-gray-700 mb-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-gray-200 font-medium mb-1">
            {submission.user.name}
          </div>
          <div className="text-xs text-gray-400">
            GitHub:{" "}
            {knownCurrentStudentGithubUsername?.github_username ? (
              <span className="text-gray-300">
                {knownCurrentStudentGithubUsername.github_username}
              </span>
            ) : (
              <button
                className="unstyled text-blue-400 hover:text-blue-300 underline"
                onClick={() => setShowGithubUsernameSelector(true)}
              >
                Select Username
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {studentRepository ? (
            <a
              href={studentRepository.repo_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm truncate block"
            >
              {studentRepository.repo_url}
            </a>
          ) : githubClassroomRepository ? (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">Not assigned</span>
              <button
                className="unstyled px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-xs"
                onClick={() => {
                  assignRepoMutation.mutate({
                    assignmentId: canvasAssignmentId,
                    repoUrl: githubClassroomRepository.repositoryUrl,
                    userId: submission.user_id,
                    repoPath: null,
                  });
                }}
              >
                Assign
              </button>
            </div>
          ) : (
            <span className="text-gray-600 text-sm italic">
              No matching repo found
            </span>
          )}
        </div>

        {githubClassroomRepository && !studentRepository?.repo_url && (
          <div className="flex-1 min-w-0">
            <a
              href={githubClassroomRepository.repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="text-gray-400 hover:text-gray-300 text-xs truncate block"
            >
              {githubClassroomRepository.repositoryUrl}
            </a>
          </div>
        )}
      </div>

      {showGithubUsernameSelector && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <StudentGithubUsernameAssignor
            githubClassroomAssignmentId={githubClassroomAssignmentId}
            canvasUserId={submission.user_id}
            studentName={submission.user.name}
            onSelected={() => setShowGithubUsernameSelector(false)}
          />
        </div>
      )}
    </div>
  );
};
