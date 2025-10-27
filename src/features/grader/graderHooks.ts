import {
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  useQueries,
  useSuspenseQueries,
} from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";

export const useSubmissionsQuery = (
  courseId: number,
  assignmentId: number,
  assignmentName: string
) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.canvas.assignments.getAssignmentSubmissions.queryOptions({
      courseId,
      assignmentId,
      assignmentName,
    })
  );
};

export const useSubmissionsQueries = (
  courseId: number,
  assignments: Array<{ id: number; name: string }>
) => {
  const trpc = useTRPC();
  return useSuspenseQueries({
    queries: assignments.map((assignment) => ({
      ...trpc.canvas.assignments.getAssignmentSubmissions.queryOptions({
        courseId,
        assignmentId: assignment.id,
        assignmentName: assignment.name,
      }),
    })),
  });
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
    trpc.canvas.attachments.downloadAllAttachments.queryOptions({
      courseId,
      assignmentId,
      userId,
    })
  );
};

export const useRubricQuery = (courseId: number, assignmentId: number) => {
  const trpc = useTRPC();
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
    trpc.githubClassroom.getClassrooms.queryOptions()
  );

  // Use useQueries to fetch assignments for all classrooms in parallel
  const assignmentQueries = useQueries({
    queries: (classroomsQuery.data || []).map((classroom) => ({
      ...trpc.githubClassroom.getClassroomAssignments.queryOptions({
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
    ...trpc.githubClassroom.getClassroomAssignments.queryOptions({
      classroomId: classroomId || "",
    }),
    enabled: !!classroomId,
  });
};

export const useUpdateSubmissionsMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.canvas.assignments.refreshAssignmentSubmissions.mutationOptions({
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: trpc.canvas.assignments.getAssignmentSubmissions.queryKey({
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
    trpc.canvas.attachments.transcribeSubmissionImages.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.fileViewer.listStudentFiles.queryKey(),
        });
      },
    })
  );
};
