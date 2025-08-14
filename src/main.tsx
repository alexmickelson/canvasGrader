import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { TRPCReactProvider } from "./server/trpc/trpcClient.tsx";
import { Toaster } from "react-hot-toast";
import { SuspenseAndError } from "./utils/SuspenseAndError.tsx";
import { BrowserRouter } from "react-router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toaster />
    <SuspenseAndError>
      <TRPCReactProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TRPCReactProvider>
    </SuspenseAndError>
  </StrictMode>
);
