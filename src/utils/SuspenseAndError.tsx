import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import type { FC, ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";

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
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};
