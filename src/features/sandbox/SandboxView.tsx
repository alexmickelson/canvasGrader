import { VncScreen } from "react-vnc";
import { SandboxAgentChat } from "./SandboxAgentChat";
import { SandboxCommandTerminal } from "./SandboxCommandTerminal";

export const SandboxView = () => {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex gap-4 min-h-0">
        <VncScreen
          url="ws://localhost:3903"
          scaleViewport
          background="#000000"
          style={{
            width: "1280px",
            height: "720px",
          }}
        />
        <div className="flex-1 flex flex-col min-w-0 h-[720px]">
          <h3 className="text-lg font-semibold mb-2 text-gray-200">
            Command Terminal
          </h3>
          <SandboxCommandTerminal />
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <SandboxAgentChat />
      </div>
    </div>
  );
};
