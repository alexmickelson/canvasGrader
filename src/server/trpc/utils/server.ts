import { type LoaderFunctionArgs } from "react-router";
import { createCallerFactory, createTRPCContext } from "./trpc";
import { appRouter } from "./main";

// allow trpc calls to be created on the server render before moving to the client
const createContext = (opts: { headers: Headers }) => {
  const headers = new Headers(opts.headers);
  headers.set("x-trpc-source", "server-loader");
  return createTRPCContext({
    headers,
  });
};

const createCaller = createCallerFactory(appRouter);
export const caller = async (loaderArgs: LoaderFunctionArgs) =>
  createCaller(await createContext({ headers: loaderArgs.request.headers }));
