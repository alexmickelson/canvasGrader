import type { FC } from "react";
import { useCurrentAssignment } from "../../../components/contexts/AssignmentProvider";
import type { GithubClassroomCourse } from "../../../server/trpc/routers/github/gitModels";
import { useGitHubClassroomAssignmentsQuery } from "../graderHooks";
import { useAssignGithubClassroomAssignmentMutation } from "../../../components/githubClassroomConfig/githubMappingHooks";

export const GithubClassroomAssignmentManagement: FC<{
  githubClassroom: GithubClassroomCourse;
}> = ({ githubClassroom }) => {
  const { assignmentId } = useCurrentAssignment();

  const { data: githubClassroomAssignments } =
    useGitHubClassroomAssignmentsQuery(githubClassroom.github_classroom_id);

  const assignClassroomAssignmentMutation =
    useAssignGithubClassroomAssignmentMutation();
  return (
    <div>
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
          className={`unstyled w-full text-left px-3 py-2 rounded text-sm transition-colors ${"hover:bg-slate-700 border border-slate-500 rounded"}`}
        >
          <div className="font-medium">{assignment.title}</div>
          <div className="text-xs opacity-75">({assignment.type})</div>
        </button>
      ))}
    </div>
  );
};
