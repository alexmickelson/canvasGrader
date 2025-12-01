import type { FC } from "react";
import { useCurrentAssignment } from "../../../../components/contexts/AssignmentProvider";
import type { GithubClassroomCourse } from "../../../../server/trpc/routers/github/gitModels";
import { useGitHubClassroomAssignmentsQuery } from "../../graderHooks";
import {
  useAssignGithubClassroomAssignmentMutation,
  useRemoveGithubClassroomAssignmentMutation,
} from "../githubMappingHooks";
import { useAiChoiceQuery } from "../../generalAiHooks";

export const GithubClassroomAssignmentManagement: FC<{
  githubClassroom: GithubClassroomCourse;
  onAssigned?: () => void;
  hasAssignment: boolean;
}> = ({ githubClassroom, onAssigned, hasAssignment }) => {
  const { assignmentId, assignmentName } = useCurrentAssignment();

  const { data: githubClassroomAssignments } =
    useGitHubClassroomAssignmentsQuery(githubClassroom.github_classroom_id);

  const assignClassroomAssignmentMutation =
    useAssignGithubClassroomAssignmentMutation();

  const removeClassroomAssignmentMutation =
    useRemoveGithubClassroomAssignmentMutation();

  const { data: aiReccommendedAssignmentName } = useAiChoiceQuery({
    options: githubClassroomAssignments?.map((a) => a.title) || [],
    prompt:
      `Given the current canvas assignment name "${assignmentName}", ` +
      `which of the following GitHub Classroom assignment names is the best match? `,
  });
  return (
    <div className="space-y-1.5 max-h-80 overflow-y-auto">
      {hasAssignment && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              removeClassroomAssignmentMutation.mutate({ assignmentId });
              onAssigned?.();
            }}
            className="unstyled text-left px-3 py-2 rounded text-sm transition-all hover:bg-red-900/30 border border-red-600/50 bg-red-900/40"
          >
            Unassign Assignment
          </button>
        </div>
      )}
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
              {assignment.title === aiReccommendedAssignmentName?.choice && (
                <span className="text-xs text-slate-500 ms-2">
                  ✨ AI Recommended
                </span>
              )}
            </div>
            <span className="text-xs px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400">
              {assignment.type}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};
