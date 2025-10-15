import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";

export type CourseGithubMappingItem = {
  enrollmentId: number;
  githubUsername: string;
};

export const useCourseGithubMapping = (courseId: number) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.githubClassroom.getGithubUsernames.queryOptions({ courseId })
  );
};

export const useUpdateCourseGithubMapping = (courseId: number) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.githubClassroom.setGithubUsername.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.githubClassroom.getGithubUsernames.queryKey({
            courseId,
          }),
        });
      },
    })
  );
};

export const useScanGithubClassroomQuery = (classroomAssignmentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.githubClassroom.scanGithubClassroom.queryOptions({
      classroomAssignmentId,
    })
  );
};
