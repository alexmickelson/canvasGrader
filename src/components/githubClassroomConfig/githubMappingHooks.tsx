import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "../../server/trpc/trpcClient";
import { useCurrentCourse } from "../contexts/CourseProvider";

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

export const useGithubStudentUsernames = () => {
  const { courseId } = useCurrentCourse();
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.githubClassroom.getGithubStudentUsernames.queryOptions({ courseId })
  );
};

export const useStoreGithubStudentUsername = () => {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const { courseId } = useCurrentCourse();

  return useMutation({
    mutationFn: async (variables: { userId: number; githubUsername: string }) =>
      await trpcClient.githubClassroom.storeGithubStudentUsername.mutate({
        courseId,
        ...variables,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.githubClassroom.getGithubStudentUsernames.queryKey({
          courseId,
        }),
      });
    },
  });
};

export const useScanGithubClassroomQuery = (classroomAssignmentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.githubClassroom.scanGithubClassroom.queryOptions({
      classroomAssignmentId,
    })
  );
};

export const useGithubClassroomIdQuery = (courseId: number) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.githubClassroom.getAssignedGithubClassroomId.queryOptions({ courseId })
  );
};

export const useAssignGithubClassroomIdMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.githubClassroom.setAssignedGithubClassroom.mutationOptions({
      onSuccess: (_data, input) => {
        queryClient.invalidateQueries({
          queryKey: trpc.githubClassroom.getAssignedGithubClassroomId.queryKey({
            courseId: input.courseId,
          }),
        });
      },
    })
  );
};

export const useGithubClassroomAssignmentQuery = (assignmentId: number) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.githubClassroom.getAssignedGithubClassroomAssignment.queryOptions({
      assignmentId,
    })
  );
};

export const useAssignGithubClassroomAssignmentMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.githubClassroom.setAssignedGithubClassroomAssignment.mutationOptions({
      onSuccess: (_data, input) => {
        queryClient.invalidateQueries({
          queryKey:
            trpc.githubClassroom.getAssignedGithubClassroomAssignment.queryKey({
              assignmentId: input.assignmentId,
            }),
        });
      },
    })
  );
};

export const useAssignedStudentRepositoriesQuery = (assignmentId: number) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.githubClassroom.getAssignedStudentRepositories.queryOptions({
      assignmentId,
    })
  );
};

export const useSetAssignedStudentRepositoryMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.githubClassroom.setAssignedStudentRepository.mutationOptions({
      onSuccess: (_data, input) => {
        queryClient.invalidateQueries({
          queryKey:
            trpc.githubClassroom.getAssignedStudentRepositories.queryKey({
              assignmentId: input.assignmentId,
            }),
        });
      },
    })
  );
};

export const useClassroomAssignmentGitUrlsQuery = (
  classroomAssignmentId: number
) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.githubClassroom.getClassroomAssignmentGitUrls.queryOptions({
      classroomAssignmentId,
    })
  );
};

export const useGuessRepositoryFromSubmission = () => {
  const trpc = useTRPC();
  return useMutation(
    trpc.githubClassroom.guessRepositoryFromSubmission.mutationOptions()
  );
};

export const useDownloadAssignedRepositories = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.githubClassroom.downloadAssignedRepositories.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.fileViewer.listStudentFiles.queryKey(),
        });
      },
    })
  );
};
