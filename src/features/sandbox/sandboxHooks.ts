import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";

export const useExecuteCommand = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  return useMutation(
    trpc.sandbox.executeCommand.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sandbox.getOutput.queryKey(),
        });
      },
    })
  );
};

export const useGetTmuxOutput = ({
  refetchInterval,
}: {
  refetchInterval: number;
}) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.sandbox.getOutput.queryOptions(undefined, {
      refetchInterval,
    })
  );
};

export const useLoadSubmissionToSandbox = () => {
  const trpc = useTRPC();
  return useMutation(trpc.sandbox.loadSubmissionToSandbox.mutationOptions());
};

export const useAiTask = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  return useMutation(
    trpc.sandbox.aiTask.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sandbox.getOutput.queryKey(),
        });
      },
    })
  );
};
