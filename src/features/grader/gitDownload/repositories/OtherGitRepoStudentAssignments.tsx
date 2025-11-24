import { useState } from "react";
import { useCurrentAssignment } from "../../../../components/contexts/AssignmentProvider";
import {
  useAssignedStudentRepositoriesQuery,
  useGuessRepositoryFromSubmission,
  useSetAssignedStudentRepositoryMutation,
  useRemoveStudentRepositoryMutation,
} from "../githubMappingHooks";
import Spinner from "../../../../utils/Spinner";
import { useSubmissionsQuery } from "../../graderHooks";
import type { ConversationMessage } from "../../../../server/trpc/routers/rubricAI/rubricAiReportModels";
import { SubmissionRepoGuesserListItem } from "./SubmissionRepoGuesserListItem";

export const OtherGitRepoStudentAssignments = () => {
  const { assignmentId, assignmentName } = useCurrentAssignment();

  const { data: canvasAssignmentSubmissions } = useSubmissionsQuery({
    assignmentId,
    assignmentName,
  });

  const {
    data: { githubRepositories: assignedStudentRepositories },
  } = useAssignedStudentRepositoriesQuery(assignmentId);

  const [aiGuesses, setAiGuesses] = useState<
    Record<
      number,
      {
        url: string;
        messages: ConversationMessage[] | null;
        reason: string;
      }
    >
  >({});

  const [manualRepoUrls, setManualRepoUrls] = useState<Record<number, string>>(
    {}
  );

  const aiGuessMutation = useGuessRepositoryFromSubmission();
  const assignRepoMutation = useSetAssignedStudentRepositoryMutation();
  const removeRepoMutation = useRemoveStudentRepositoryMutation();

  const unassignedSubmissions = canvasAssignmentSubmissions.filter(
    (submission) =>
      !assignedStudentRepositories.some(
        (repo) => repo.user_id === submission.user_id
      )
  );

  const guessAllUnassigned = async () => {
    await Promise.all(
      unassignedSubmissions.map(async (submission) => {
        const guessResult = await aiGuessMutation.mutateAsync({
          assignmentId,
          submisisonId: submission.id,
          checkPreviousAssignments: true,
        });

        const guess = guessResult.result?.repoUrl
          ? {
              url: guessResult.result.repoUrl,
              messages: guessResult.messages || null,
              reason: guessResult.result.reason ?? "",
            }
          : { url: "null", messages: null, reason: "" };

        setAiGuesses((prev) => ({
          ...prev,
          [submission.id]: guess,
        }));
      })
    );
  };

  const assignAllGuesses = () => {
    Object.entries(aiGuesses).forEach(([submissionIdStr, guess]) => {
      if (guess.url && guess.url !== "null") {
        const submission = canvasAssignmentSubmissions.find(
          (s) => s.id === Number(submissionIdStr)
        );
        if (submission) {
          assignRepoMutation.mutate({
            assignmentId,
            repoUrl: guess.url,
            userId: submission.user_id,
            repoPath: null,
          });
        }
      }
    });
  };

  const validGuessesCount = Object.values(aiGuesses).filter(
    (guess) => guess.url && guess.url !== "null"
  ).length;

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {unassignedSubmissions.length > 0 && (
          <button
            className="unstyled px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={guessAllUnassigned}
            disabled={aiGuessMutation.isPending}
          >
            Guess All Unassigned
            {aiGuessMutation.isPending && <Spinner />}
          </button>
        )}
        {validGuessesCount > 0 && (
          <button
            className="unstyled px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={assignAllGuesses}
            disabled={assignRepoMutation.isPending}
          >
            Assign All Guesses ({validGuessesCount})
            {assignRepoMutation.isPending && <Spinner />}
          </button>
        )}
      </div>
      <ul
        className={
          "divide-y divide-gray-800 bg-gray-900 rounded border border-gray-700 my-3 " +
          "max-h-[600px] overflow-auto"
        }
      >
        {canvasAssignmentSubmissions.map((submission) => (
          <SubmissionRepoGuesserListItem
            key={submission.id}
            submission={submission}
            aiGuess={aiGuesses[submission.id]}
            setAiGuess={(guess: {
              url: string;
              messages: ConversationMessage[] | null;
              reason: string;
            }) => setAiGuesses((prev) => ({ ...prev, [submission.id]: guess }))}
            manualRepoUrl={manualRepoUrls[submission.id] || ""}
            setManualRepoUrl={(url: string) =>
              setManualRepoUrls((prev) => ({ ...prev, [submission.id]: url }))
            }
            aiGuessMutation={aiGuessMutation}
            assignRepoMutation={assignRepoMutation}
            removeRepoMutation={removeRepoMutation}
          />
        ))}
      </ul>
    </div>
  );
};
