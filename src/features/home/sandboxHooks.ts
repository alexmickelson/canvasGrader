import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";

export const useExecuteCommand = () => {
  const trpc = useTRPC();
  return useMutation(trpc.sandbox.executeCommand.mutationOptions());
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
