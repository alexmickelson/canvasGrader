# GitHub Copilot Instructions

- use less than 30 words to summarize actions taken
- only style with Tailwind CSS, match the style of the project
- use inline interfaces for component props e.g.
    ```tsx
    export const SubmissionFileExplorer: FC<{
      courseId: number;
      assignmentId: number;
      studentName: string;
      className: string;
    }
    > = ({
      courseId,
      assignmentId,
      studentName,
      className,
    })
    ```