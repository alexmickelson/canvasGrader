import { useState, useRef, type FormEvent, type FC } from "react";
import {
  useExecuteCommandMutation,
  useGetTmuxOutputQuery,
} from "./sandboxHooks";

export const SandboxCommandTerminal: FC = () => {
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const executeCommand = useExecuteCommandMutation();
  const { data } = useGetTmuxOutputQuery({ refetchInterval: 200 });

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
    <div className="flex flex-col gap-2 flex-1 overflow-auto">
      <div className="flex-1 bg-black text-green-400 font-mono p-4 rounded overflow-auto whitespace-pre-wrap">
          {data?.currentOutput}
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
