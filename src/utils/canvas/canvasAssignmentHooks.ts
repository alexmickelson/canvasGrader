import {
  useMutation,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";
import { useCurrentCourse } from "../../components/contexts/CourseProvider";
import { useFavoriteCoursesQuery } from "../../features/home/settingsHooks";
import type { CanvasAssignment } from "../../server/trpc/routers/canvas/canvasModels";
import { useCanvasCoursesQuery } from "./canvasHooks";

export const useAssignmentsQuery = () => {
  const trpc = useTRPC();
  const { courseId } = useCurrentCourse();
  return useSuspenseQuery(
    trpc.canvas.assignments.getAssignmentsInCourse.queryOptions({ courseId }),
  );
};

export const useRefreshAssignmentsMutation = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  return useMutation(
    trpc.canvas.assignments.refreshAssignmentsInCourse.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.canvas.assignments.getAssignmentsInCourse.queryKey(),
        });
      },
    }),
  );
};

export const useDeleteAllCourseDataMutation = () => {
  const { courseId, courseName, termName } = useCurrentCourse();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const mutation = useMutation(
    trpc.canvas.course.deleteCourseData.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
    }),
  );

  return {
    ...mutation,
    mutate: () => mutation.mutate({ courseId, courseName, termName }),
    mutateAsync: () => mutation.mutateAsync({ courseId, courseName, termName }),
  };
};

export const useAssignmentsFromAllCoursesQuery = () => {
  const { data: courses } = useFavoriteCoursesQuery();
  const trpc = useTRPC();

  return useSuspenseQueries({
    queries: courses.map((course) => {
      return trpc.canvas.assignments.getAssignmentsInCourse.queryOptions(
        {
          courseId: course.id,
        },
        {
          select: (data) => ({ courseId: course.id, assignments: data }),
        },
      );
    }),
  });
};

export const useFullAssignmentDataQuery = (assignments: CanvasAssignment[]) => {
  const { data: courses } = useCanvasCoursesQuery();
  const trpc = useTRPC();
  return useSuspenseQueries({
    queries: assignments.map((assignment) => {
      const course = courses.find((c) => c.id === assignment.course_id);
      if (!course) {
        console.log(courses);
        throw new Error(
          `Course with ID ${assignment.course_id} not found for assignment ${assignment.id}`,
        );
      }
      return {
        ...trpc.canvas.assignments.getAssignmentSubmissions.queryOptions(
          {
            courseId: course.id,
            courseName: course.name,
            termName: course.term.name,
            assignmentId: assignment.id,
            assignmentName: assignment.name,
          },
          {
            select: (data) => ({
              course,
              assignment,
              submissions: data,
            }),
          },
        ),
      };
    }),
  });
};
