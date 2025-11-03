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
  courseId,
  assignmentId,
  assignmentName,
  termName,
  courseName,
}: {
  courseId: number;
  assignmentId: number;
  assignmentName: string;
  termName: string;
  courseName: string;
}) => {
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
  courseId: number,
  assignments: Array<{ id: number; name: string }>,
  courseName: string,
  termName: string
) => {
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

export const useDownloadAttachmentsQuery = ({
  courseId,
  assignmentId,
  userId,
  courseName,
  termName,
  studentName,
  assignmentName,
}: {
  courseId: number;
  assignmentId: number;
  userId: number;
  courseName: string;
  termName: string;
  studentName: string;
  assignmentName: string;
}) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.canvas.attachments.downloadAllAttachments.queryOptions({
      courseId,
      assignmentId,
      userId,
      courseName,
      termName,
      studentName,
      assignmentName,
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
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const { courseId, courseName } = useCurrentCourse();

  return useMutation({
    mutationFn: async (variables: {
      assignmentId: number;
      assignmentName: string;
      termName: string;
      studentName?: string;
      studentId?: number;
    }) => {
      return await trpcClient.canvas.assignments.refreshAssignmentSubmissions.mutate(
        {
          courseId,
          courseName,
          ...variables,
        }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.canvas.assignments.getAssignmentSubmissions.queryKey({
          courseId,
          assignmentId: variables.assignmentId,
        }),
      });
    },
  });
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
