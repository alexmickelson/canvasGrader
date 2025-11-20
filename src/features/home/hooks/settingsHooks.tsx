import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC } from "../../../server/trpc/trpcClient";

export const useSettingsQuery = () => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.settings.getSettings.queryOptions());
};

export const useUpdateSettingsMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.settings.updateSettings.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getSettings.queryKey(),
        });
      },
    })
  );
};
