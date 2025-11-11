import { describe, it, expect } from "vitest";
import { parseClassroomList, parseAssignmentList } from "./githubCliParser";

describe("GitHub CLI Parser", () => {
  describe("parseClassroomList", () => {
    it("should parse valid classroom list output", () => {
      const output = `ID      Name              URL
100001  distributed       https://classroom.github.com/classrooms/example-org/distributed
100002  2025-fall-1420    https://classroom.github.com/classrooms/example-org/2025-fall-1420
100003  adv-frontend      https://classroom.github.com/classrooms/example-org/adv-frontend
100004  webIntroFall2025  https://classroom.github.com/classrooms/example-org/webintrofall2025`;

      const result = parseClassroomList(output);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({
        id: "100001",
        name: "distributed",
        url: "https://classroom.github.com/classrooms/example-org/distributed",
      });
      expect(result[1]).toEqual({
        id: "100002",
        name: "2025-fall-1420",
        url: "https://classroom.github.com/classrooms/example-org/2025-fall-1420",
      });
      expect(result[2]).toEqual({
        id: "100003",
        name: "adv-frontend",
        url: "https://classroom.github.com/classrooms/example-org/adv-frontend",
      });
      expect(result[3]).toEqual({
        id: "100004",
        name: "webIntroFall2025",
        url: "https://classroom.github.com/classrooms/example-org/webintrofall2025",
      });
    });

    it("should handle multi-word classroom names", () => {
      const output = `ID      Name              URL
200001  Advanced Web Development  https://classroom.github.com/classrooms/test-org/advanced-web-dev
200002  Intro to Programming      https://classroom.github.com/classrooms/test-org/intro-prog`;

      const result = parseClassroomList(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "200001",
        name: "Advanced Web Development",
        url: "https://classroom.github.com/classrooms/test-org/advanced-web-dev",
      });
      expect(result[1]).toEqual({
        id: "200002",
        name: "Intro to Programming",
        url: "https://classroom.github.com/classrooms/test-org/intro-prog",
      });
    });

    it("should return empty array for header-only output", () => {
      const output = `ID      Name              URL`;
      const result = parseClassroomList(output);
      expect(result).toEqual([]);
    });

    it("should return empty array for empty output", () => {
      const output = ``;
      const result = parseClassroomList(output);
      expect(result).toEqual([]);
    });

    it("should handle extra whitespace and newlines", () => {
      const output = `  ID      Name              URL  
  300001  distributed       https://classroom.github.com/classrooms/demo-org/distributed  
  300002  2025-fall-1420    https://classroom.github.com/classrooms/demo-org/2025-fall-1420  `;

      const result = parseClassroomList(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "300001",
        name: "distributed",
        url: "https://classroom.github.com/classrooms/demo-org/distributed",
      });
    });

    it("should filter out malformed lines", () => {
      const output = `ID      Name              URL
400001  distributed       https://classroom.github.com/classrooms/sample-org/distributed
invalid-line
400002  2025-fall-1420    https://classroom.github.com/classrooms/sample-org/2025-fall-1420`;

      const result = parseClassroomList(output);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("400001");
      expect(result[1].id).toBe("400002");
    });
  });

  describe("parseAssignmentList", () => {
    it("should parse valid assignment list output", () => {
      const output = `ID      Title             Type        Status
10001   Assignment 1      individual  active
10002   Group Project     group       draft
10003   Final Exam        individual  published`;

      const result = parseAssignmentList(output);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: "10001",
        title: "Assignment 1",
        type: "individual",
        status: "active",
      });
      expect(result[1]).toEqual({
        id: "10002",
        title: "Group Project",
        type: "group",
        status: "draft",
      });
      expect(result[2]).toEqual({
        id: "10003",
        title: "Final Exam",
        type: "individual",
        status: "published",
      });
    });

    it("should parse actual GitHub CLI assignment output format", () => {
      const output = `3 Assignments for adv-frontend

ID      Title                 Submission Public  Type        Deadline  Editor  Invitation Link                          Accepted  Submissions  Passing
828226  Tic Tac Toe Tutorial  false              individual                    https://classroom.github.com/a/upaHbZnf  13        13           0
828255  embeddings            false              individual                    https://classroom.github.com/a/G2ruYK8b  12        12           0
852193  aiChat                false              individual                    https://classroom.github.com/a/_9jQfTA6  0         0            0`;

      const result = parseAssignmentList(output);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: "828226",
        title: "Tic Tac Toe Tutorial",
        type: "individual",
        status: "active",
      });
      expect(result[1]).toEqual({
        id: "828255",
        title: "embeddings",
        type: "individual",
        status: "active",
      });
      expect(result[2]).toEqual({
        id: "852193",
        title: "aiChat",
        type: "individual",
        status: "active",
      });
    });

    it("should handle tab-separated values", () => {
      const output = `ID\tTitle\tType\tStatus
20001\tAssignment 1\tindividual\tactive
20002\tGroup Project\tgroup\tdraft`;

      const result = parseAssignmentList(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "20001",
        title: "Assignment 1",
        type: "individual",
        status: "active",
      });
    });

    it("should handle multi-word assignment titles", () => {
      const output = `ID      Title                           Type        Status
30001   Web Development Assignment 1    individual  active
30002   Advanced JavaScript Project     group       draft`;

      const result = parseAssignmentList(output);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Web Development Assignment 1");
      expect(result[1].title).toBe("Advanced JavaScript Project");
    });

    it("should provide defaults for missing fields", () => {
      const output = `ID      Title             
40001   Assignment 1      
40002   Group Project     group`;

      const result = parseAssignmentList(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "40001",
        title: "Assignment 1",
        type: "individual",
        status: "active",
      });
      expect(result[1]).toEqual({
        id: "40002",
        title: "Group Project",
        type: "group",
        status: "active",
      });
    });

    it("should handle minimal output with just ID and Title headers", () => {
      const output = `ID      Title
50001   Assignment One
50002   Assignment Two`;

      const result = parseAssignmentList(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "50001",
        title: "Assignment One",
        type: "individual",
        status: "active",
      });
      expect(result[1]).toEqual({
        id: "50002",
        title: "Assignment Two",
        type: "individual",
        status: "active",
      });
    });

    it("should return empty array for header-only output", () => {
      const output = `ID      Title             Type        Status`;
      const result = parseAssignmentList(output);
      expect(result).toEqual([]);
    });

    it("should return empty array for empty output", () => {
      const output = ``;
      const result = parseAssignmentList(output);
      expect(result).toEqual([]);
    });

    it("should handle assignment output with summary line", () => {
      const output = `2 Assignments for test-classroom

ID      Title             Submission Public  Type        Deadline  Editor  Invitation Link                    Accepted  Submissions  Passing
60001   Web Assignment    false              individual                    https://classroom.github.com/a/abc123  5         5            3
60002   Group Work        false              group                         https://classroom.github.com/a/def456  8         8            2`;

      const result = parseAssignmentList(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "60001",
        title: "Web Assignment",
        type: "individual",
        status: "active",
      });
      expect(result[1]).toEqual({
        id: "60002",
        title: "Group Work",
        type: "group",
        status: "active",
      });
    });
  });

  describe("parseAcceptedAssignmentList", () => {
    it("can parse list", () => {
      //  gh classroom accepted-assignments --assignment-id 890322
      const output = `Assignment: lab10Assignment
ID: 890322

ID        Submitted  Passing  Commit Count  Grade  Feedback Pull Request URL  Student                       Repository
21391584  false      false    7                                               student1, student2            https://github.com/test-org-2025/lab10assignment-student1-student2
21391589  false      false    2                                               student3                      https://github.com/test-org-2025/lab10assignment-student3-student4
21391592  false      false    6                                               student5, student6            https://github.com/test-org-2025/lab10assignment-student5-student6
21391597  false      false    4                                               student7, student8            https://github.com/test-org-2025/lab10assignment-student7-student8
21391619  false      false    3                                               student9, student10           https://github.com/test-org-2025/lab10assignment-student9-student10`;
    });
  });
});
