import { useAssignGithubClassroomIdMutation } from "../../../components/githubClassroomConfig/githubMappingHooks";
import { useLoadGithubClassroomDataQuery } from "../graderHooks";

export const AssignGithubClassroomToCourse: React.FC<{
  courseId: number;
  onClick: () => void;
}> = ({ courseId, onClick }) => {
  const assignGithubClassroomMutation = useAssignGithubClassroomIdMutation();
  const { data: githubClassroomOptions } = useLoadGithubClassroomDataQuery();

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
          className="unstyled w-full text-left px-3 py-2 rounded text-sm transition-colors hover:bg-blue-700 border border-slate-500"
        >
          <div className="font-medium">{classroom.name}</div>
        </button>
      ))}
    </div>
  );
};
