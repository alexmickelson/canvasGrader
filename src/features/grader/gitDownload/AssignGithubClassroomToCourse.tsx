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
    <div>
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
          className={`unstyled w-full text-left px-3 py-2 rounded text-sm transition-colors hover:bg-blue-700 border ${
            classroom.name === aiRecommendedClassroom?.choice
              ? "border-blue-500"
              : "border-slate-500"
          }`}
        >
          <div className="font-medium">{classroom.name}</div>
        </button>
      ))}
    </div>
  );
};
