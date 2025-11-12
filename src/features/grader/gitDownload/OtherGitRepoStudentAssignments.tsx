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
import { useCurrentCourse } from "../../../components/contexts/CourseProvider";
import type { ConversationMessage } from "../../../server/trpc/routers/rubricAI/rubricAiReportModels";
import { ConversationHistory } from "../shared/ConversationHistory";
import { Expandable } from "../../../utils/Expandable";
import ExpandIcon from "../../../utils/ExpandIcon";

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
          />
        ))}
      </ul>
    </div>
  );
};

const SubmissionRepoGuesserListItem: FC<{
  submission: CanvasSubmission;
  aiGuess?: {
    url: string;
    messages: ConversationMessage[] | null;
    reason: string;
  };
  setAiGuess: (guess: {
    url: string;
    messages: ConversationMessage[] | null;
    reason: string;
  }) => void;
  manualRepoUrl: string;
  setManualRepoUrl: (url: string) => void;
  aiGuessMutation: ReturnType<typeof useGuessRepositoryFromSubmission>;
  assignRepoMutation: ReturnType<
    typeof useSetAssignedStudentRepositoryMutation
  >;
}> = ({
  submission,
  aiGuess,
  setAiGuess,
  manualRepoUrl,
  setManualRepoUrl,
  aiGuessMutation,
  assignRepoMutation,
}) => {
  const { assignmentId } = useCurrentAssignment();
  const { courseId } = useCurrentCourse();

  const {
    data: { githubRepositories: assignedStudentRepositories },
  } = useAssignedStudentRepositoriesQuery(assignmentId);

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
            checkPreviousAssignments: true,
          });
          console.log(guessResult);

          if (guessResult.result?.repoUrl) {
            setAiGuess({
              url: guessResult.result.repoUrl,
              messages: guessResult.messages || null,
              reason: guessResult.result.reason ?? "",
            });
          } else {
            setAiGuess({ url: "null", messages: null, reason: "" });
          }
        }}
        disabled={aiGuessMutation.isPending}
      >
        Guess repo from submission
        {aiGuessMutation.isPending && <Spinner />}
      </button>
      {aiGuess?.url && aiGuess.url !== "null" && (
        <>
          <div className="mt-2 p-3 bg-gray-900/50 rounded border border-gray-700 flex items-center justify-between gap-2">
            <a
              href={aiGuess.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400/70 hover:text-blue-400 text-sm truncate flex-1"
            >
              {aiGuess.url}
            </a>
            <button
              className="unstyled px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm whitespace-nowrap"
              onClick={() => {
                assignRepoMutation.mutate({
                  assignmentId,
                  repoUrl: aiGuess.url,
                  userId: submission.user_id,
                  repoPath: null,
                });
              }}
            >
              Assign Repo
            </button>
          </div>
          {aiGuess.reason && (
            <div className="mt-1 text-xs text-gray-400">
              <strong>Reason:</strong> {aiGuess.reason}
            </div>
          )}
        </>
      )}
      {aiGuess?.url === "null" && (
        <div className="mt-2 p-3 bg-gray-900/50 rounded border border-gray-700 flex flex-col gap-2">
          <div className="text-sm text-gray-400">
            Could not guess repository. Review submission:
          </div>
          <a
            href={`https://snow.instructure.com/courses/${courseId}/gradebook/speed_grader?assignment_id=${assignmentId}&student_id=${submission.user_id}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-400/70 hover:text-blue-400 text-sm"
          >
            Open SpeedGrader
          </a>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Paste repository URL"
              value={manualRepoUrl}
              onChange={(e) => setManualRepoUrl(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-300 text-sm focus:outline-none focus:border-gray-600"
            />
            <button
              className="unstyled px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm whitespace-nowrap disabled:opacity-50"
              disabled={!manualRepoUrl.trim()}
              onClick={() => {
                assignRepoMutation.mutate({
                  assignmentId,
                  repoUrl: manualRepoUrl.trim(),
                  userId: submission.user_id,
                  repoPath: null,
                });
              }}
            >
              Assign
            </button>
          </div>
        </div>
      )}
      {aiGuess?.messages && (
        <Expandable
          ExpandableElement={({ isExpanded, setIsExpanded }) => (
            <div
              className="flex flex-row justify-between cursor-pointer p-1 m-1 rounded bg-purple-950/30 "
              onClick={() => setIsExpanded((e) => !e)}
            >
              <div className="px-1 flex-1">AI Guess Conversation History</div>
              <button className="unstyled">
                <ExpandIcon
                  style={{
                    ...(isExpanded ? { rotate: "-90deg" } : {}),
                  }}
                />
              </button>
            </div>
          )}
        >
          <ConversationHistory conversation={aiGuess.messages} />
        </Expandable>
      )}
    </li>
  );
};
