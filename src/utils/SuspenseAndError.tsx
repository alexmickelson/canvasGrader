import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import type { FC, ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";
import Spinner from "./Spinner";

export const SuspenseAndError: FC<{ children: ReactNode }> = ({ children }) => {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ resetErrorBoundary }) => {
        return (
          <div>
            There was an error!
            <button onClick={() => resetErrorBoundary()}>Try again</button>
          </div>
        );
      }}
    >
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-full">
            <Spinner />
          </div>
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};
