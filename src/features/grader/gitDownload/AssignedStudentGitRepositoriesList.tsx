import type { FC } from "react";
import type { GithubClassroomAssignment } from "../../../server/trpc/routers/github/gitModels";
import { useAssignedStudentRepositoriesQuery } from "../../../components/githubClassroomConfig/githubMappingHooks";
import { useSubmissionsQuery } from "../graderHooks";
import { useCurrentAssignment } from "../../../components/contexts/AssignmentProvider";
import { SubmissionRepoListItem } from "./SubmissionRepoListItem";

export const AssignedStudentGitRepositoriesList: FC<{
  githubClassroomAssignment: GithubClassroomAssignment;
}> = ({ githubClassroomAssignment }) => {
  const { assignmentId, assignmentName } = useCurrentAssignment();
  const {
    data: { githubRepositories: submissionRepositories },
  } = useAssignedStudentRepositoriesQuery(
    githubClassroomAssignment.assignment_id
  );

  const { data: assignmentSubmissions } = useSubmissionsQuery({
    assignmentId,
    assignmentName,
  });

  return (
    <div>
      Github Classroom Assignment: {githubClassroomAssignment.name}
      <div>
        {assignmentSubmissions.map((submission) => (
          <SubmissionRepoListItem
            key={submission.id}
            submission={submission}
            githubClassroomAssignmentId={
              githubClassroomAssignment.assignment_id
            }
          />
        ))}
      </div>
    </div>
  );
};
