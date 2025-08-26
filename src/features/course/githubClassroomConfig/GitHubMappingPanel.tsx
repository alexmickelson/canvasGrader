import { type FC, useState, useEffect } from "react";
import {
  useSettingsQuery,
  useUpdateSettingsMutation,
} from "../../home/settingsHooks";
import { useScanGithubClassroomQuery } from "./githubMappingHooks";

export const GitHubMappingPanel: FC<{
  courseId: number;
  classroomAssignmentId?: string;
}> = ({ courseId, classroomAssignmentId }) => {
  const { data: settings } = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const [mappingJson, setMappingJson] = useState(() => {
    const course = settings?.courses?.find((c) => c.canvasId === courseId);
    return JSON.stringify(course?.githubUserMap || [], null, 2);
  });
  useEffect(() => {
    const course = settings?.courses?.find((c) => c.canvasId === courseId);
    setMappingJson(JSON.stringify(course?.githubUserMap || [], null, 2));
  }, [settings, courseId]);

  // Scan logic
  const [scanRequested, setScanRequested] = useState(false);
  const scanQuery = useScanGithubClassroomQuery(classroomAssignmentId || "");
  console.log(scanQuery.data);

  const save = () => {
    try {
      const mapping = JSON.parse(mappingJson || "[]");
      if (!Array.isArray(mapping))
        throw new Error(
          "Mapping must be an array of {studentName, githubUsername}"
        );
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
      <textarea
        value={mappingJson}
        onChange={(e) => setMappingJson(e.target.value)}
        className="w-full h-32 mt-2 p-2 bg-gray-800 text-gray-200"
      />
      <div className="flex gap-2 mt-2">
        <button onClick={save} className="px-3 py-1 bg-blue-700 rounded">
          Save mappings
        </button>
        <button
          onClick={() => setScanRequested(true)}
          className="px-3 py-1 bg-green-700 rounded"
          disabled={!classroomAssignmentId || scanQuery.isFetching}
        >
          Scan Classroom
        </button>
      </div>
      {scanRequested && scanQuery.data && (
        <div className="mt-2 text-sm text-gray-300">
          <div className="font-medium">Scan Results (usernames)</div>
          <ul className="list-disc list-inside">
            {scanQuery.data.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}
      {scanRequested && scanQuery.isLoading && (
        <div className="mt-2 text-sm text-gray-400">Scanning...</div>
      )}
      {scanRequested && scanQuery.error && (
        <div className="mt-2 text-sm text-red-400">
          Error: {String(scanQuery.error)}
        </div>
      )}
    </div>
  );
};
