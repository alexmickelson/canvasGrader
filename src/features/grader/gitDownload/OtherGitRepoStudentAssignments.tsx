import type { FC } from "react";
import { useState } from "react";
import { useCurrentAssignment } from "../../../components/contexts/AssignmentProvider";
import {
  useAssignedStudentRepositoriesQuery,
  useGuessRepositoryFromSubmission,
  useSetAssignedStudentRepositoryMutation,
} from "../../../components/githubClassroomConfig/githubMappingHooks";
import Spinner from "../../../utils/Spinner";
import { useSubmissionsQuery } from "../graderHooks";
import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasModels";

export const OtherGitRepoStudentAssignments = () => {
  const { assignmentId, assignmentName } = useCurrentAssignment();

  const { data: canvasAssignmentSubmissions } = useSubmissionsQuery({
    assignmentId,
    assignmentName,
  });

  return (
    <ul className="divide-y divide-gray-800 bg-gray-800 rounded border border-gray-700">
      {canvasAssignmentSubmissions.map((submission) => (
        <SubmissionRepoGuesserListItem
          key={submission.id}
          submission={submission}
          assignmentId={assignmentId}
        />
      ))}
    </ul>
  );
};

const SubmissionRepoGuesserListItem: FC<{
  submission: CanvasSubmission;
  assignmentId: number;
}> = ({ submission, assignmentId }) => {
  const [aiGuessUrl, setAiGuessUrl] = useState("");

  const {
    data: { githubRepositories: assignedStudentRepositories },
  } = useAssignedStudentRepositoriesQuery(assignmentId);
  const aiGuessMutation = useGuessRepositoryFromSubmission();
  const assignRepoMutation = useSetAssignedStudentRepositoryMutation();

  const assignedRepo = assignedStudentRepositories.find(
    (repo) => repo.user_id === submission.user_id
  );

  if (assignedRepo) {
    return (
      <li className="p-3 flex items-center justify-between">
        <span className="text-gray-300">{submission.user.name}</span>
        <a
          href={assignedRepo.repo_url}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400/70 hover:text-blue-400 text-sm truncate max-w-md"
        >
          {assignedRepo.repo_url}
        </a>
      </li>
    );
  }

  return (
    <li className="p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-300">{submission.user.name}</span>
        <span className="text-sm px-2 py-1 rounded bg-gray-700/50 text-gray-500 border border-gray-700">
          Not assigned
        </span>
      </div>
      <button
        className="unstyled px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        onClick={async () => {
          const guessResult = await aiGuessMutation.mutateAsync({
            assignmentId,
            submisisonId: submission.id,
          });

          if (guessResult.repoUrl) setAiGuessUrl(guessResult.repoUrl);
        }}
        disabled={aiGuessMutation.isPending}
      >
        Guess repo from submission
        {aiGuessMutation.isPending && <Spinner />}
      </button>
      {aiGuessUrl && (
        <div className="mt-2 p-3 bg-gray-900/50 rounded border border-gray-700 flex items-center justify-between gap-2">
          <a
            href={aiGuessUrl}
            target="_blank"
            rel="noreferrer"
            className="text-blue-400/70 hover:text-blue-400 text-sm truncate flex-1"
          >
            {aiGuessUrl}
          </a>
          <button
            className="unstyled px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm whitespace-nowrap"
            onClick={() => {
              assignRepoMutation.mutate({
                assignmentId,
                repoUrl: aiGuessUrl,
                userId: submission.user_id,
                repoPath: null,
              });
            }}
          >
            Assign Repo
          </button>
        </div>
      )}
    </li>
  );
};
