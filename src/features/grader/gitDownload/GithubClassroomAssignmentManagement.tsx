import type { FC } from "react";
import { useCurrentAssignment } from "../../../components/contexts/AssignmentProvider";
import type { GithubClassroomCourse } from "../../../server/trpc/routers/github/gitModels";
import { useGitHubClassroomAssignmentsQuery } from "../graderHooks";
import { useAssignGithubClassroomAssignmentMutation } from "../../../components/githubClassroomConfig/githubMappingHooks";
import { useAiChoiceQuery } from "../../home/generalAiHooks";

export const GithubClassroomAssignmentManagement: FC<{
  githubClassroom: GithubClassroomCourse;
  onAssigned?: () => void;
}> = ({ githubClassroom, onAssigned }) => {
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
    <div className="space-y-1.5 max-h-80 overflow-y-auto">
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
            onAssigned?.();
          }}
          className={`unstyled w-full text-left px-3 py-2 rounded text-sm transition-all hover:bg-slate-700 border ${
            assignment.title === aiReccommendedAssignmentName?.choice
              ? "border-blue-400/60 bg-blue-500/10"
              : "border-slate-600/50 bg-slate-800/30"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-slate-200">
              {assignment.title}
            </div>
            <span className="text-xs px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400">
              {assignment.type}
            </span>
          </div>
          {assignment.title === aiReccommendedAssignmentName?.choice && (
            <div className="text-xs text-blue-400/80 mt-0.5">
              ✨ AI Recommended
            </div>
          )}
        </button>
      ))}
    </div>
  );
};
