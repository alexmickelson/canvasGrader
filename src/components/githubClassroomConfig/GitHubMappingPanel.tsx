import { useSuspenseQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import {
  useSettingsQuery,
  useUpdateSettingsMutation,
} from "../../features/home/settingsHooks";
import { useTRPC } from "../../server/trpc/trpcClient";
import { useScanGithubClassroomQuery } from "./githubMappingHooks";

export const GitHubMappingPanel: FC<{
  courseId: number;
  classroomAssignmentId: string;
}> = ({ courseId, classroomAssignmentId }) => {
  const { data: settings } = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();

  // Fetch enrollments from server storage (suspense query)
  const trpc = useTRPC();
  const enrollmentsQuery = useSuspenseQuery(
    trpc.canvas.listCourseEnrollments.queryOptions({ courseId })
  );
  const studentEnrollments = enrollmentsQuery.data.filter(
    (e) => e.type === "StudentEnrollment"
  );

  const { data: scanUsernames } = useScanGithubClassroomQuery(
    classroomAssignmentId
  );

  const course = settings?.courses?.find((c) => c.canvasId === courseId);
  const [mapping, setMapping] = useState<
    { studentName: string; githubUsername: string }[]
  >(course?.githubUserMap ?? []);
  // console.log("Current mapping:", mapping);

  const assignedUsernames = new Set(
    mapping.map((m) => m.githubUsername.toLowerCase())
  );

  const assignUsername = (studentName: string, username: string) => {
    // remove username from any other mapping and set to this student
    const next = mapping.filter(
      (m) => m.githubUsername.toLowerCase() !== username.toLowerCase()
    );
    // find existing entry for student
    const idx = next.findIndex((m) => m.studentName === studentName);
    if (idx === -1) {
      next.push({ studentName, githubUsername: username });
    } else {
      next[idx].githubUsername = username;
    }
    setMapping(next);
  };

  const save = () => {
    try {
      const newSettings = { ...(settings || { courses: [] }) };
      const idx = newSettings.courses.findIndex((c) => c.canvasId === courseId);
      if (idx === -1) {
        newSettings.courses.push({
          name: `Course ${courseId}`,
          canvasId: courseId,
          githubUserMap: mapping,
        });
      } else {
        newSettings.courses[idx].githubUserMap = mapping;
      }
      updateSettings.mutate(newSettings);
    } catch (e) {
      alert("Invalid JSON mapping: " + String(e));
    }
  };

  return (
    <div className="p-3 mb-4 bg-gray-900 rounded">
      <h3 className="font-semibold">GitHub username mappings</h3>
      <div>
        <ul className="divide-y divide-gray-800 max-h-200 overflow-auto">
          {studentEnrollments.map((en) => {
            const name = en.user?.name || `User ${en.user_id}`;
            const assigned =
              (mapping.find((m) => m.studentName === name) || {})
                .githubUsername || "";

            return (
              <li key={en.user_id} className="p-2 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="text-gray-200">{name}</div>
                  <div className="text-sm text-gray-400">
                    {assigned || "Not assigned"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {scanUsernames.map((u) => {
                    const isAssignedToOther =
                      assignedUsernames.has(u.toLowerCase()) &&
                      assigned.toLowerCase() !== u.toLowerCase();
                    const isAssignedToThis =
                      assigned.toLowerCase() === u.toLowerCase();

                    return (
                      <button
                        key={u}
                        className={`unstyled px-2 py-1 rounded text-xs transition-colors ${
                          isAssignedToThis
                            ? "bg-green-600 text-white"
                            : isAssignedToOther
                            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                        disabled={isAssignedToOther}
                        onClick={() => assignUsername(name, u)}
                      >
                        {u}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={save} className="px-3 py-1 bg-blue-700 rounded">
          Save mappings
        </button>
      </div>
    </div>
  );
};
