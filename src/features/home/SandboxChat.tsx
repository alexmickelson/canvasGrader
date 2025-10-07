import { VncScreen } from "react-vnc";
import { useState, useRef, type FormEvent } from "react";
import { useExecuteCommand, useGetTmuxOutput } from "./sandboxHooks";

export const SandboxChat = () => {
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const executeCommand = useExecuteCommand();
  const { data: output } = useGetTmuxOutput({ refetchInterval: 1000 });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    setCommand("");
    await executeCommand.mutateAsync({
      command,
      sessionName: "default",
    });
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <VncScreen
          url="ws://localhost:3903"
          scaleViewport
          background="#000000"
          style={{
            width: "1280px",
            height: "720px",
          }}
        />
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex-1 bg-black text-green-400 font-mono p-4 rounded overflow-auto whitespace-pre-wrap">
            {output?.output || "No output yet..."}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter command..."
              className="flex-1 px-3 py-2 border rounded"
              disabled={executeCommand.isPending}
            />
            <button
              type="submit"
              disabled={executeCommand.isPending || !command.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              {executeCommand.isPending ? "Running..." : "Execute"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
