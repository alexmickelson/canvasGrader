import { useCurrentCourse } from "../../../components/contexts/CourseProvider";
import {
  useGithubClassroomAssignmentQuery,
  useGithubClassroomIdQuery,
} from "../../../components/githubClassroomConfig/githubMappingHooks";
import { AssignGithubClassroomToCourse } from "./AssignGithubClassroomToCourse";
import { GithubClassroomAssignmentManagement } from "./GithubClassroomAssignmentManagement";
import { useCurrentAssignment } from "../../../components/contexts/AssignmentProvider";
import { useState } from "react";

export const ClassroomAndAssignmentFromGithubAssignmentCoordinator = () => {
  const [reassignClassroom, setReassignClassroom] = useState(false);
  const [reassignAssignment, setReassignAssignment] = useState(false);
  const { assignmentId } = useCurrentAssignment();
  const { courseId } = useCurrentCourse();

  const {
    data: { classroom: githubClassroom },
  } = useGithubClassroomIdQuery(courseId);

  const {
    data: { githubClassroomAssignment },
  } = useGithubClassroomAssignmentQuery(assignmentId);

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded p-3 border border-slate-700">
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
          GitHub Classroom
        </div>
        {githubClassroom?.course_id ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-blue-300">
                {githubClassroom.name}
              </div>
              <button
                onClick={() => setReassignClassroom(true)}
                className="unstyled px-3 py-1 bg-slate-700/50 hover:bg-slate-600 rounded text-xs transition-colors border border-slate-600/50"
              >
                Reassign
              </button>
            </div>
            {(!githubClassroom?.github_classroom_id || reassignClassroom) && (
              <div className="pt-2 border-t border-slate-700/50">
                <AssignGithubClassroomToCourse
                  courseId={courseId}
                  onClick={() => setReassignClassroom(false)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-slate-400 text-xs">No classroom assigned</p>
            <AssignGithubClassroomToCourse
              courseId={courseId}
              onClick={() => setReassignClassroom(false)}
            />
          </div>
        )}
      </div>

      {githubClassroom && (
        <div className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
            Classroom Assignment
          </div>
          {!githubClassroomAssignment || reassignAssignment ? (
            <div>
              <p className="text-slate-500 text-xs mb-2">
                Select an assignment
              </p>
              <GithubClassroomAssignmentManagement
                githubClassroom={githubClassroom}
                onAssigned={() => setReassignAssignment(false)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-green-300">
                  {githubClassroomAssignment.name}
                </div>
                <button
                  onClick={() => setReassignAssignment(true)}
                  className="unstyled px-3 py-1 bg-slate-700/50 hover:bg-slate-600 rounded text-xs transition-colors border border-slate-600/50"
                >
                  Reassign
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
