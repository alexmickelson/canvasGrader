import type { FC } from "react";
import type { CanvasSubmission } from "../../../server/trpc/routers/canvas/canvasModels";
import { useAssignedStudentRepositoriesQuery } from "../../../components/githubClassroomConfig/githubMappingHooks";

export const SubmissionRepoListItem: FC<{
  submission: CanvasSubmission;
  githubClassroomAssignmentId: number;
}> = ({ submission, githubClassroomAssignmentId }) => {
  const {
    data: { githubRepositories: submissionRepositories },
  } = useAssignedStudentRepositoriesQuery(githubClassroomAssignmentId);

  const studentRepository = submissionRepositories.find(
    (repo) => repo.user_id === submission.user_id
  );

  

  return (
    <div>
      {submission.user.name}
      <div>
        {studentRepository ? (
          <div>{studentRepository.repo_url}</div>
        ) : (
          <div>repo not assigned</div>
        )}
      </div>
    </div>
  );
};
