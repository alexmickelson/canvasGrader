import { type FC, useState } from "react";
import {
  useSettingsQuery,
  useUpdateSettingsMutation,
} from "../../home/settingsHooks";
import { useScanGithubClassroomQuery } from "./githubMappingHooks";
// Spinner not needed here
import { useTRPC } from "../../../server/trpc/trpcClient";
import { useSuspenseQuery } from "@tanstack/react-query";

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
  const enrollments = enrollmentsQuery.data

  const scanQuery = useScanGithubClassroomQuery(classroomAssignmentId);

  const course = settings?.courses?.find((c) => c.canvasId === courseId);
  const [mapping, setMapping] = useState<
    { studentName: string; githubUsername: string }[]
  >(course?.githubUserMap ?? []);
  console.log("Current mapping:", mapping);


  // Available usernames = scan results minus assigned
  const scanUsernames = (scanQuery.data || []) as string[];
  const assignedUsernames = new Set(
    mapping.map((m) => m.githubUsername.toLowerCase())
  );
  const availableUsernames = scanUsernames.filter(
    (u) => !assignedUsernames.has(u.toLowerCase())
  );

  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

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
      <p className="text-sm text-gray-400">
        Edit mappings for students in this course (JSON array of objects:
        [&#123; studentName: string, githubUsername: string &#125;])
      </p>
      <div className="grid grid-cols-2 gap-4 mt-2">
        <div>
          <div className="font-medium text-sm text-gray-300 mb-2">Students</div>
          <ul className="divide-y divide-gray-800 max-h-64 overflow-auto">
            {enrollments.map((en) => {
              const name = en.user?.name || `User ${en.user_id}`;
              const assigned =
                (mapping.find((m) => m.studentName === name) || {})
                  .githubUsername || "";
              const isSelected = selectedStudent === name;
              return (
                <li
                  key={en.user_id}
                  className={`p-2 flex items-center justify-between ${
                    isSelected ? "bg-gray-800" : ""
                  }`}
                >
                  <div className="text-gray-200">{name}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-400">{assigned}</div>
                    <button
                      className="px-2 py-1 bg-gray-700 rounded text-sm"
                      onClick={() => setSelectedStudent(name)}
                    >
                      Select
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <div className="font-medium text-sm text-gray-300 mb-2">
            Available GitHub Usernames
          </div>
          <ul className="divide-y divide-gray-800 max-h-64 overflow-auto">
            {availableUsernames.map((u) => (
              <li key={u} className="p-2 flex items-center justify-between">
                <div className="text-gray-200">{u}</div>
                <div>
                  <button
                    className="px-2 py-1 bg-blue-600 rounded text-sm"
                    onClick={() => {
                      const target =
                        selectedStudent ||
                        enrollments[0]?.user?.name ||
                        `User ${enrollments[0]?.user_id}`;
                      if (!target) return;
                      assignUsername(target, u);
                    }}
                  >
                    Assign
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={save} className="px-3 py-1 bg-blue-700 rounded">
          Save mappings
        </button>
      </div>
      {scanQuery.data && (
        <div className="mt-2 text-sm text-gray-300">
          <div className="font-medium">Scan Results (usernames)</div>
          <ul className="list-disc list-inside">
            {scanQuery.data.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
