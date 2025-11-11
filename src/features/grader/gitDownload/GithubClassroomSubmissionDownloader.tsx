import { useState } from "react";
import { useCurrentAssignment } from "../../../components/contexts/AssignmentProvider";
import { useCurrentCourse } from "../../../components/contexts/CourseProvider";
import {
  useGithubClassroomAssignmentQuery,
  useGithubClassroomIdQuery,
} from "../../../components/githubClassroomConfig/githubMappingHooks";
import { Modal } from "../../../components/Modal";
import { AssignGithubClassroomToCourse } from "./AssignGithubClassroomToCourse";
import { GithubClassroomAssignmentManagement } from "./GithubClassroomAssignmentManagement";
import { AssignedStudentGitRepositoriesList } from "./AssignedStudentGitRepositoriesList";

export const GithubClassroomSubmissionDownloader = () => {
  const { courseId } = useCurrentCourse();
  const { assignmentId } = useCurrentAssignment();
  const [reassignClassroom, setReassignClassroom] = useState(false);

  const {
    data: { classroom: githubClassroom },
  } = useGithubClassroomIdQuery(courseId);

  const {
    data: { githubClassroomAssignment },
  } = useGithubClassroomAssignmentQuery(assignmentId);

  return (
    <Modal
      title="Download Git Repos"
      Button={({ onClick }) => (
        <button
          onClick={onClick}
          // disabled={!githubClassroom}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors"
        >
          New GitHub Classroom
        </button>
      )}
    >
      {({ onClose }) => {
        return (
          <div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            {githubClassroom?.course_id ? (
              <div className="flex align-middle justify-between">
                <div className="my-auto">
                  Github Classroom Name:
                  <div>{githubClassroom.name}</div>
                </div>
                <button
                  onClick={() => setReassignClassroom(true)}
                  className="m-2"
                >
                  ReAssign?
                </button>
              </div>
            ) : (
              <div>Assign a classroom for the course</div>
            )}

            {(!githubClassroom?.github_classroom_id || reassignClassroom) && (
              <AssignGithubClassroomToCourse
                courseId={courseId}
                onClick={() => setReassignClassroom(false)}
              />
            )}
            <hr />
            <br />
            <div>
              {githubClassroom && !githubClassroomAssignment && (
                <GithubClassroomAssignmentManagement
                  githubClassroom={githubClassroom}
                />
              )}
              {githubClassroomAssignment && (
                <div>
                  Assigned Classroom Assignment:
                  <div>
                    {githubClassroomAssignment.github_classroom_assignment_id}
                  </div>
                </div>
              )}
            </div>

            <div>
              {githubClassroomAssignment && (
                <div>
                  <AssignedStudentGitRepositoriesList githubClassroomAssignment={githubClassroomAssignment} />
                </div>
              )}
            </div>
          </div>
        );
      }}
    </Modal>
  );
};
