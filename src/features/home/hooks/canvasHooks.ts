import {
  useSuspenseQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { useTRPC } from "../../../server/trpc/trpcClient";

export const useCanvasCoursesQuery = () => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.canvas.course.getCourses.queryOptions());
};

export const useRefreshCanvasCoursesQuery = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.canvas.course.refreshCourses.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.canvas.course.getCourses.queryKey(),
        });
      },
    })
  );
};
