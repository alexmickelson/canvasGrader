import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";

export const useFavoriteCoursesQuery = () => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.settings.getFavoriteCourses.queryOptions());
};

export const useAddFavoriteCourseMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.settings.addFavoriteCourse.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getFavoriteCourses.queryKey(),
        });
      },
    })
  );
};

export const useRemoveFavoriteCourseMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.settings.removeFavoriteCourse.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getFavoriteCourses.queryKey(),
        });
      },
    })
  );
};
