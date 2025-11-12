import type { FC } from "react";
import type { GithubClassroomAssignment } from "../../../server/trpc/routers/github/gitModels";
import { useSubmissionsQuery } from "../graderHooks";
import { useCurrentAssignment } from "../../../components/contexts/AssignmentProvider";
import { SubmissionRepoListItem } from "./SubmissionRepoListItem";
import { SuspenseAndError } from "../../../utils/SuspenseAndError";

export const AssignedGithubClassroomStudentGitRepositoriesList: FC<{
  githubClassroomAssignment: GithubClassroomAssignment;
}> = ({ githubClassroomAssignment }) => {
  const { assignmentId, assignmentName } = useCurrentAssignment();

  const { data: canvasAssignmentSubmissions } = useSubmissionsQuery({
    assignmentId,
    assignmentName,
  });

  return (
    <SuspenseAndError>
      <div>
        Github Classroom Assignment: {githubClassroomAssignment.name}
        <hr />
        <br />
        <div className="max-h-[800px] overflow-auto p-2 bg-slate-900">
          {canvasAssignmentSubmissions.map((submission) => (
            <SubmissionRepoListItem
              key={submission.id}
              submission={submission}
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
