import {
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  useQueries,
  useSuspenseQueries,
} from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "../../server/trpc/trpcClient";
import { useCurrentCourse } from "../../components/contexts/CourseProvider";

export const useSubmissionsQuery = ({
  assignmentId,
  assignmentName,
}: {
  assignmentId: number;
  assignmentName: string;
}) => {
  const { courseName, courseId, termName } = useCurrentCourse();
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.canvas.assignments.getAssignmentSubmissions.queryOptions({
      courseId,
      assignmentId,
      assignmentName,
      termName,
      courseName,
    })
  );
};

export const useSubmissionsQueries = (
  assignments: Array<{ id: number; name: string }>
) => {
  const { courseName, courseId, termName } = useCurrentCourse();
  const trpc = useTRPC();
  return useSuspenseQueries({
    queries: assignments.map((assignment) => ({
      ...trpc.canvas.assignments.getAssignmentSubmissions.queryOptions({
        courseId,
        assignmentId: assignment.id,
        assignmentName: assignment.name,
        courseName,
        termName,
      }),
    })),
  });
};

export const useRubricQuery = (assignmentId: number) => {
  const trpc = useTRPC();

  const { courseId } = useCurrentCourse();
  return useQuery(
    trpc.canvas.assignments.getAssignmentRubric.queryOptions({
      courseId,
      assignmentId,
    })
  );
};

export const useGitHubClassroomMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.githubClassroom.downloadAndOrganizeRepositories.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.fileViewer.listStudentFiles.queryKey(),
        });
      },
    })
  );
};

export const useAiAnalysisMutation = () => {
  const trpc = useTRPC();

  const queryClient = useQueryClient();
  return useMutation(
    trpc.rubricAiReport.analyzeRubricCriterion.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.rubricAiReport.getAllEvaluations.queryKey(),
        });
      },
    })
  );
};

export const useAllEvaluationsQuery = ({
  submissionId,
}: {
  submissionId: number;
}) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.rubricAiReport.getAllEvaluations.queryOptions({
      submissionId,
    })
  );
};

// GitHub Classroom hooks
export const useLoadGithubClassroomDataQuery = () => {
  const trpc = useTRPC();

  const classroomsQuery = useQuery(
    trpc.githubClassroom.getClassrooms.queryOptions()
  );

  // Use useQueries to fetch assignments for all classrooms in parallel
  const assignmentQueries = useQueries({
    queries: (classroomsQuery.data || []).map((classroom) => ({
      ...trpc.githubClassroom.getClassroomAssignments.queryOptions({
        classroomId: classroom.id,
      }),
      enabled: !!classroom.id && !!classroomsQuery.data,
    })),
  });

  return {
    ...classroomsQuery,
    assignmentQueries,
  };
};

export const useGitHubClassroomAssignmentsQuery = (
  classroomId: number
) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.githubClassroom.getClassroomAssignments.queryOptions({
      classroomId: classroomId,
    }),
    enabled: !!classroomId,
  });
};

export const useUpdateSubmissionsMutation = () => {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const { courseId, courseName, termName } = useCurrentCourse();

  return useMutation({
    mutationFn: async (variables: {
      studentName?: string;
      studentId?: number;
      assignmentId: number;
      assignmentName: string;
    }) => {
      return await trpcClient.canvas.assignments.refreshAssignmentSubmissions.mutate(
        {
          courseId,
          courseName,
          termName,
          ...variables,
        }
      );
    },
    onSuccess: (_, { assignmentId }) => {
      queryClient.invalidateQueries({
        queryKey: trpc.canvas.assignments.getAssignmentSubmissions.queryKey({
          courseId,
          assignmentId,
        }),
      });
    },
  });
};

export const useTranscribeSubmissionImagesMutation = () => {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const { courseId } = useCurrentCourse();
  return useMutation({
    mutationFn: ({
      assignmentId,
      assignmentName,
    }: {
      assignmentId: number;
      assignmentName: string;
    }) => {
      return trpcClient.canvas.attachments.transcribeSubmissionImages.mutate({
        courseId,
        assignmentId,
        assignmentName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.fileViewer.listStudentFiles.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.fileViewer.getFileContent.queryKey(),
      });
    },
  });
};
