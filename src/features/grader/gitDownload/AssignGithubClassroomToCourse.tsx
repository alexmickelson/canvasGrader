import { useAssignGithubClassroomIdMutation } from "../../../components/githubClassroomConfig/githubMappingHooks";
import { useLoadGithubClassroomDataQuery } from "../graderHooks";
import { useCurrentCourse } from "../../../components/contexts/CourseProvider";
import { useAiChoiceQuery } from "../../home/generalAiHooks";

export const AssignGithubClassroomToCourse: React.FC<{
  courseId: number;
  onClick: () => void;
}> = ({ courseId, onClick }) => {
  const { courseName } = useCurrentCourse();
  const assignGithubClassroomMutation = useAssignGithubClassroomIdMutation();
  const { data: githubClassroomOptions } = useLoadGithubClassroomDataQuery();

  const { data: aiRecommendedClassroom } = useAiChoiceQuery({
    options: githubClassroomOptions?.map((c) => c.name) || [],
    prompt:
      `Given the current Canvas course name "${courseName}", ` +
      `which of the following GitHub Classroom names is the best match?`,
  });

  return (
    <div className="space-y-1.5 max-h-80 overflow-y-auto">
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
          <div className="font-semibold text-slate-200">{classroom.name}</div>
          {classroom.name === aiRecommendedClassroom?.choice && (
            <div className="text-xs text-blue-400/80 mt-0.5">
              ✨ AI Recommended
            </div>
          )}
        </button>
      ))}
    </div>
  );
};
