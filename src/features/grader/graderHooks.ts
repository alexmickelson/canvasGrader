import {
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  useQueries,
} from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";

export const useSubmissionsQuery = (
  courseId: number,
  assignmentId: number,
  assignmentName: string
) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.canvas.getAssignmentSubmissions.queryOptions({
      courseId,
      assignmentId,
      assignmentName,
    })
  );
};

export const useDownloadAttachmentsQuery = ({
  courseId,
  assignmentId,
  userId,
}: {
  courseId: number;
  assignmentId: number;
  userId: number;
}) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.canvas.downloadAllAttachments.queryOptions({
      courseId,
      assignmentId,
      userId,
    })
  );
};

export const useRubricQuery = (courseId: number, assignmentId: number) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.canvas.getAssignmentRubric.queryOptions({
      courseId,
      assignmentId,
    })
  );
};

export const useGitHubClassroomMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.canvas.downloadAndOrganizeRepositories.mutationOptions({
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
  assignmentId,
  assignmentName,
  courseName,
  termName,
  studentName,
}: {
  assignmentId: number;
  assignmentName: string;
  courseName: string;
  termName: string;
  studentName: string;
}) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.rubricAiReport.getAllEvaluations.queryOptions({
      assignmentId,
      assignmentName,
      courseName,
      termName,
      studentName,
    })
  );
};

// GitHub Classroom hooks
export const useLoadGithubClassroomDataQuery = () => {
  const trpc = useTRPC();

  const classroomsQuery = useQuery(
    trpc.canvas.getGitHubClassrooms.queryOptions()
  );

  // Use useQueries to fetch assignments for all classrooms in parallel
  const assignmentQueries = useQueries({
    queries: (classroomsQuery.data || []).map((classroom) => ({
      ...trpc.canvas.getGitHubClassroomAssignments.queryOptions({
        classroomId: classroom.id || "",
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
  classroomId: string | null
) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.canvas.getGitHubClassroomAssignments.queryOptions({
      classroomId: classroomId || "",
    }),
    enabled: !!classroomId,
  });
};

export const useUpdateSubmissionsMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.canvas.refreshAssignmentSubmissions.mutationOptions({
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.canvas.getAssignmentSubmissions.queryKey({
            courseId: variables.courseId,
            assignmentId: variables.assignmentId,
          }),
        });
      },
    })
  );
};

export const useTranscribeSubmissionImagesMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.canvas.transcribeSubmissionImages.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.fileViewer.listStudentFiles.queryKey(),
        });
      },
    })
  );
};
