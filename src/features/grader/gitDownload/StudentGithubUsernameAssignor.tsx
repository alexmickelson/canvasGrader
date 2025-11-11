import type { FC } from "react";
import {
  useClassroomAssignmentGitUrlsQuery,
  useGithubStudentUsernames,
} from "../../../components/githubClassroomConfig/githubMappingHooks";
import type { CanvasEnrollment } from "../../../server/trpc/routers/canvas/canvasModels";

export const StudentGithubUsernameAssignor: FC<{
  githubClassroomAssignmentId: number;
  canvasUserId: number;
}> = ({ githubClassroomAssignmentId, canvasUserId }) => {
  const { data: assignedStudentGithubUsernames } = useGithubStudentUsernames(
    githubClassroomAssignmentId
  );
  const { data: githubClassroomRepoUrls } = useClassroomAssignmentGitUrlsQuery(
    githubClassroomAssignmentId
  );

  const alreadyAssignedUsername = assignedStudentGithubUsernames.find(
    (ghu) => ghu.user_id === canvasUserId
  );

  
  const usernameOptions = githubClassroomRepoUrls.flatMap(
    (repo) => repo.students
  );
  console.log(githubClassroomRepoUrls, githubClassroomAssignmentId);

  return (
    <div>
      {usernameOptions.map((username) => {
        return <div key={username}>{username}</div>;
      })}

      {/* {assignedStudentGithubUsernames.map((username) => {

        return <div key={username.github_username}></div>;
      })} */}
    </div>
  );
};
