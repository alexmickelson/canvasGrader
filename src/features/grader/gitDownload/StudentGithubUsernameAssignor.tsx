import type { FC } from "react";
import {
  useClassroomAssignmentGitUrlsQuery,
  useGithubStudentUsernames,
  useStoreGithubStudentUsername,
} from "./githubMappingHooks";
import { useAiChoiceQuery } from "../generalAiHooks";

export const StudentGithubUsernameAssignor: FC<{
  githubClassroomAssignmentId: number;
  canvasUserId: number;
  studentName: string;
  onSelected: () => void;
}> = ({
  githubClassroomAssignmentId,
  canvasUserId,
  studentName,
  onSelected,
}) => {
  const { data: assignedStudentGithubUsernames } = useGithubStudentUsernames();
  const { data: githubClassroomRepoUrls } = useClassroomAssignmentGitUrlsQuery(
    githubClassroomAssignmentId
  );

  const alreadyAssignedUsername = assignedStudentGithubUsernames.find(
    (ghu) => ghu.user_id === canvasUserId
  );

  const usernameOptions = githubClassroomRepoUrls.flatMap(
    (repo) => repo.students
  );
  const storeGithubUsernameMutation = useStoreGithubStudentUsername();

  const assignedUsernames = new Set(
    assignedStudentGithubUsernames
      .map((ghu) => ghu.github_username?.toLowerCase())
      .filter(Boolean)
  );

  const { data: aiRecommendedUsername } = useAiChoiceQuery({
    options: usernameOptions || [],
    prompt:
      `Given the student name "${studentName}", ` +
      `which of the following GitHub usernames is the best match?`,
  });

  // console.log("assigned", assignedStudentGithubUsernames);

  return (
    <div className="flex flex-wrap gap-1">
      {usernameOptions.map((username) => {
        const isAssignedToThis =
          alreadyAssignedUsername?.github_username?.toLowerCase() ===
          username.toLowerCase();
        const isAssignedToOther =
          assignedUsernames.has(username.toLowerCase()) && !isAssignedToThis;

        const isAiRecommended = username === aiRecommendedUsername?.choice;

        return (
          <button
            key={username}
            className={`unstyled px-2 py-1 rounded text-xs transition-colors ${
              isAssignedToThis
                ? "bg-green-900 text-white"
                : isAssignedToOther
                ? "bg-gray-900 text-gray-400 cursor-not-allowed"
                : isAiRecommended
                ? "bg-blue-700 hover:bg-blue-600 text-white border border-blue-500"
                : "bg-blue-900 hover:bg-blue-700 text-white"
            }`}
            disabled={isAssignedToOther}
            onClick={() => {
              storeGithubUsernameMutation.mutate({
                userId: canvasUserId,
                githubUsername: username,
              });
              onSelected();
            }}
          >
            {username}
            {isAiRecommended && !isAssignedToThis && " ✨"}
          </button>
        );
      })}
    </div>
  );
};
