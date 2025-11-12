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

  return (
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
        />
      ))}
    </ul>
  );
};

const SubmissionRepoGuesserListItem: FC<{
  submission: CanvasSubmission;
}> = ({ submission }) => {
  const { assignmentId } = useCurrentAssignment();
  const { courseId } = useCurrentCourse();

  const [aiGuessUrl, setAiGuessUrl] = useState("");
  const [manualRepoUrl, setManualRepoUrl] = useState("");
  const [aiGuessMessages, setAiGuessMessages] = useState<
    ConversationMessage[] | null
  >(null);

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
            checkPreviousAssignments: true,
          });
          console.log(guessResult);

          if (guessResult.result.repoUrl) {
            setAiGuessUrl(guessResult.result.repoUrl);
            setAiGuessMessages(guessResult.messages || null);
          } else {
            setAiGuessUrl("null");
          }
        }}
        disabled={aiGuessMutation.isPending}
      >
        Guess repo from submission
        {aiGuessMutation.isPending && <Spinner />}
      </button>
      {aiGuessUrl && aiGuessUrl !== "null" && (
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
      {aiGuessUrl === "null" && (
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
      {aiGuessMessages && (
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
          <ConversationHistory conversation={aiGuessMessages} />
        </Expandable>
      )}
    </li>
  );
};
