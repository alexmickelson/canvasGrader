import type { FC } from "react";
import { useCurrentAssignment } from "../../../components/contexts/AssignmentProvider";
import type { GithubClassroomCourse } from "../../../server/trpc/routers/github/gitModels";
import { useGitHubClassroomAssignmentsQuery } from "../graderHooks";
import { useAssignGithubClassroomAssignmentMutation } from "../../../components/githubClassroomConfig/githubMappingHooks";
import { useAiChoiceQuery } from "../../home/generalAiHooks";

export const GithubClassroomAssignmentManagement: FC<{
  githubClassroom: GithubClassroomCourse;
}> = ({ githubClassroom }) => {
  const { assignmentId, assignmentName } = useCurrentAssignment();

  const { data: githubClassroomAssignments } =
    useGitHubClassroomAssignmentsQuery(githubClassroom.github_classroom_id);

  const assignClassroomAssignmentMutation =
    useAssignGithubClassroomAssignmentMutation();

  const { data: aiReccommendedAssignmentName } = useAiChoiceQuery({
    options: githubClassroomAssignments?.map((a) => a.title) || [],
    prompt:
      `Given the current canvas assignment name "${assignmentName}", ` +
      `which of the following GitHub Classroom assignment names is the best match? `,
  });
  return (
    <div className="max-h-[400px] overflow-y-auto my-3 p-1 bg-slate-900">
      {githubClassroomAssignments?.map((assignment) => (
        <button
          key={assignment.id}
          onClick={() => {
            assignClassroomAssignmentMutation.mutate({
              assignmentId,
              githubClassroomAssignmentId: assignment.id,
              githubClassroomId: githubClassroom.github_classroom_id,
              name: assignment.title,
            });
          }}
          className={`unstyled w-full text-left px-3 py-2 rounded text-sm transition-colors hover:bg-slate-700 border ${
            assignment.title === aiReccommendedAssignmentName?.choice
              ? "border-blue-500"
              : "border-slate-500"
          }`}
        >
          <div className="font-medium">{assignment.title}</div>
          <div className="text-xs opacity-75">({assignment.type})</div>
        </button>
      ))}
    </div>
  );
};
