import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../../server/trpc/trpcClient";

export const useAiChoiceQuery = ({
  prompt,
  options,
}: {
  prompt: string;
  options: string[];
}) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.generalAi.getAiChoice.queryOptions({
      prompt,
      options,
    }),
    enabled: !!prompt && options.length > 0,
  });
};
