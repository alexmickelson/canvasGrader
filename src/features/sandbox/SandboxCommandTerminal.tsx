import { useState, useRef, type FormEvent, type FC } from "react";
import { useExecuteCommand, useGetTmuxOutput } from "./sandboxHooks";

export const SandboxCommandTerminal: FC = () => {
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const executeCommand = useExecuteCommand();
  const { data } = useGetTmuxOutput({ refetchInterval: 200 });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    setCommand("");
    await executeCommand.mutateAsync({
      command,
    });
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex-1 bg-black text-green-400 font-mono p-4 rounded overflow-auto whitespace-pre-wrap">
        {data?.history && data.history.length > 0
          ? data.history.map((entry, idx) => (
              <div key={idx} className="mb-2">
                <div className="text-blue-400">
                  {entry.directory}$ {entry.command}
                </div>
                {entry.stdout && (
                  <div className="text-green-400">{entry.stdout}</div>
                )}
                {entry.stderr && (
                  <div className="text-red-400">ERROR: {entry.stderr}</div>
                )}
              </div>
            ))
          : "No output yet..."}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enter command..."
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
          disabled={executeCommand.isPending}
        />
        <button
          type="submit"
          disabled={executeCommand.isPending || !command.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {executeCommand.isPending ? "Running..." : "Execute"}
        </button>
      </form>
    </div>
  );
};
