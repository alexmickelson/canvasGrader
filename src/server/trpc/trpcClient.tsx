import SuperJSON from "superjson";
import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "./utils/main";
import { toast } from "react-hot-toast";

export function invalidateQueries(
  queryClient: QueryClient,
  queries: { queryKey: () => readonly unknown[] }[]
) {
  queries.forEach((query) => {
    queryClient.invalidateQueries({
      queryKey: query.queryKey(),
    });
  });
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 0,
      },
      mutations: {
        onError: (error: unknown) => {
          console.error("query client mutation error", error);
          toast.error(
            `Error: ${
              error instanceof Error
                ? error.message
                : "An unknown error occurred"
            }`
          );
        },
      },
    },
    queryCache: new QueryCache({
      onError: (e: unknown) => {
        console.error("query client error", e);
        toast.error(
          `Error: ${
            e instanceof Error ? e.message : "An unknown error occurred"
          }`
        );
      },
    }),
  });
}
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}
export const trpcLinks = [
  httpBatchStreamLink({
    transformer: SuperJSON,
    maxURLLength: 10_000,
    url: "/trpc",
    headers() {
      const headers = new Headers();
      headers.set("x-trpc-source", "react");
      return headers;
    },
  }),
];

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: trpcLinks,
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
