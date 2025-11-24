import {
  useAssignGithubClassroomIdMutation,
  useRemoveGithubClassroomIdMutation,
  useGithubClassroomIdQuery,
} from "../githubMappingHooks";
import { useLoadGithubClassroomDataQuery } from "../../graderHooks";
import { useCurrentCourse } from "../../../../components/contexts/CourseProvider";
import { useAiChoiceQuery } from "../../../home/hooks/generalAiHooks";

export const AssignGithubClassroomToCourse: React.FC<{
  courseId: number;
  onClick: () => void;
}> = ({ courseId, onClick }) => {
  const { courseName } = useCurrentCourse();
  const assignGithubClassroomMutation = useAssignGithubClassroomIdMutation();
  const removeGithubClassroomMutation = useRemoveGithubClassroomIdMutation();
  const { data: githubClassroomOptions } = useLoadGithubClassroomDataQuery();
  const { data: assignedClassroom } = useGithubClassroomIdQuery(courseId);

  const { data: aiRecommendedClassroom } = useAiChoiceQuery({
    options: githubClassroomOptions?.map((c) => c.name) || [],
    prompt:
      `Given the current Canvas course name "${courseName}", ` +
      `which of the following GitHub Classroom names is the best match?`,
  });

  return (
    <div className="space-y-1.5 max-h-80 overflow-y-auto">
      {!assignedClassroom && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              removeGithubClassroomMutation.mutate({ courseId });
              onClick();
            }}
            className="unstyled text-left px-3 py-2 rounded text-sm transition-all hover:bg-red-900/30 border border-red-600/50 bg-red-900/40"
          >
            Unassign Classroom
          </button>
        </div>
      )}
      {githubClassroomOptions?.map((classroom) => (
        <button
          key={classroom.id}
          onClick={() => {
            assignGithubClassroomMutation.mutate({
              courseId,
              githubClassroomId: classroom.id,
              name: classroom.name,
              url: classroom.url,
            });
            onClick();
          }}
          className={`unstyled w-full text-left px-3 py-2 rounded text-sm transition-all hover:bg-slate-700 border ${
            classroom.name === aiRecommendedClassroom?.choice
              ? "border-blue-400/60 bg-blue-500/10"
              : "border-slate-600/50 bg-slate-800/30"
          }`}
        >
          <div className="font-semibold text-slate-200">
            {classroom.name}{" "}
            {classroom.name === aiRecommendedClassroom?.choice && (
              <span className="text-xs text-slate-500 mt-0.5">
                ✨ AI Recommended
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};
