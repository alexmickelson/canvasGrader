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
      <p className="text-sm text-gray-400 mb-4">
        Select GitHub usernames for each student in this course
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main mapping interface */}
        <div className="lg:col-span-2">
          <div className="font-medium text-sm text-gray-300 mb-2">Students</div>
          <ul className="divide-y divide-gray-800 max-h-96 overflow-auto bg-gray-800 rounded border border-gray-700">
            {studentEnrollments.map((en) => {
              const name = en.user?.name || `User ${en.user_id}`;
              const assigned =
                (mapping.find((m) => m.studentName === name) || {})
                  .githubUsername || "";

              return (
                <li key={en.user_id} className="p-3 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-gray-200 font-medium">{name}</div>
                    <div
                      className={`text-sm px-2 py-1 rounded ${
                        assigned
                          ? "bg-green-600/20 text-green-300 border border-green-600/30"
                          : "bg-gray-600/20 text-gray-400 border border-gray-600/30"
                      }`}
                    >
                      {assigned || "Not assigned"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
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

        {/* Current mappings sidebar */}
        <div className="lg:col-span-1">
          <div className="font-medium text-sm text-gray-300 mb-2">
            Current Mappings ({mapping.length})
          </div>
          <div className="bg-gray-800 rounded border border-gray-700 max-h-96 overflow-auto">
            {mapping.length > 0 ? (
              <ul className="divide-y divide-gray-700">
                {mapping.map((map, idx) => (
                  <li key={idx} className="p-3">
                    <div className="text-sm">
                      <div className="text-gray-200 font-medium mb-1">
                        {map.studentName}
                      </div>
                      <div className="text-blue-300 text-xs">
                        @{map.githubUsername}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-gray-400 text-sm">
                No mappings yet
              </div>
            )}
          </div>

          {/* Unassigned usernames */}
          <div className="mt-4">
            <div className="font-medium text-sm text-gray-300 mb-2">
              Unassigned Usernames ({scanUsernames.length - mapping.length})
            </div>
            <div className="bg-gray-800 rounded border border-gray-700 p-3">
              {scanUsernames.filter(
                (u) => !assignedUsernames.has(u.toLowerCase())
              ).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {scanUsernames
                    .filter((u) => !assignedUsernames.has(u.toLowerCase()))
                    .map((u) => (
                      <span
                        key={u}
                        className="px-2 py-1 bg-gray-600 text-gray-300 rounded text-xs"
                      >
                        {u}
                      </span>
                    ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 text-sm">
                  All usernames assigned
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={save}
        >
          Save mappings
        </button>
      </div>
    </div>
  );
};
