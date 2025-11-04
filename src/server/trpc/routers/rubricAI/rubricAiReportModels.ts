import z from "zod";

// Evidence formatting requirements for AI prompts
export const evidenceSchemaPrompt = `EVIDENCE FORMATTING REQUIREMENTS:
- fileName: Must be an EXACT filename from the submission file system (e.g., "src/App.tsx", "README.md")
  - NEVER use conceptual names like "File System Tree", "Overall Structure", etc.
  - Only reference actual files that exist in the submission
  - Include the full relative path if the file is in a subdirectory
- lineStart: Starting line number (integer, 1-based) or null
  - Use for text-based files where you can specify line ranges
  - Use null for non-text files, images, or when referencing entire files
- lineEnd: Ending line number (integer, 1-based) or null
  - Use for text-based files where you can specify line ranges
  - Use null for non-text files, images, or when referencing entire files
- description: Clear, specific explanation of how this evidence supports the criterion

IMPORTANT: Only include evidence entries for actual files you have examined with the read_file tool. Do not create evidence entries based solely on the file system structure or absence of files.

EXAMPLES:

Example 1 - Full Credit (criterion met with evidence):
{
  "recommendedPoints": 2,
  "description": "Student successfully implemented the required functionality with proper code structure",
  "evidence": [
    {
      "fileName": "src/App.tsx",
      "lineStart": 15,
      "lineEnd": 23,
      "description": "React component correctly implements the required useState hook for managing state"
    },
    {
      "fileName": "README.md",
      "lineStart": null,
      "lineEnd": null,
      "description": "Documentation clearly explains the implementation approach"
    }
  ]
}

Example 2 - No Credit (evidence not found):
{
  "recommendedPoints": 0,
  "description": "The required functionality is not present in the submission",
  "evidence": []
}`;

// Schema for evidence in analysis results
export const EvidenceSchema = z.object({
  fileName: z
    .string()
    .min(1)
    .describe(
      "Exact filename from submission (e.g., 'README.md', 'src/App.tsx'). Never use conceptual names."
    ),
  lineStart: z
    .number()
    .min(1)
    .nullable()
    .describe("Starting line number (1-based, null for non-text files)"),
  lineEnd: z
    .number()
    .min(1)
    .nullable()
    .describe("Ending line number (1-based, null for non-text files)"),
  description: z
    .string()
    .min(1)
    .describe(
      "Clear explanation of how this evidence relates to the criterion"
    ),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

// Define structured output schema for AI analysis
export const AnalysisResultSchema = z
  .object({
    recommendedPoints: z
      .number()
      .min(0)
      .describe(
        "Recommended points to award for this criterion, if unsure, provide 0"
      ),
    description: z.string().describe("brief explanation of the assessment"),
    evidence: z
      .array(EvidenceSchema)
      .default([])
      .describe("Array of evidence found in the submission files"),
  })
  .transform((data) => ({
    ...data,
    evidence: data.evidence || [], // Ensure evidence is always an array
  }));

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// Schema for evaluation metadata
export const EvaluationMetadataSchema = z.object({
  courseId: z.number(),
  assignmentId: z.number(),
  studentName: z.string(),
  criterionId: z.string().optional(),
  criterionDescription: z.string(),
  timestamp: z.string(),
  model: z.string(),
});

export type EvaluationMetadata = z.infer<typeof EvaluationMetadataSchema>;

// Schema for tool calls in conversation messages
export const ToolCallSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  function: z
    .object({
      name: z.string(),
      arguments: z.string().optional(),
    })
    .optional(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

// Schema for conversation messages (internal domain model)
export const ConversationMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z
    .union([
      z.string(),
      z.array(
        z.object({
          type: z.enum(["text", "image_url"]),
          text: z.string().optional(),
          image_url: z
            .object({
              base64: z.string().describe("Base64 encoded image data"),
              mediaType: z
                .string()
                .optional()
                .describe("MIME type of the image (e.g., 'image/png')"),
            })
            .nullable()
            .optional(),
        })
      ),
    ])
    .nullable()
    .optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
  tool_call_id: z.string().optional(),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

// Schema for full evaluation data
export const FullEvaluationSchema = z.object({
  fileName: z.string().describe("Name of the evaluation file"),
  metadata: EvaluationMetadataSchema.describe("Evaluation metadata"),
  conversation: z
    .array(ConversationMessageSchema)
    .describe("Complete conversation history with AI"),
  evaluation: AnalysisResultSchema.describe(
    "Structured analysis result from AI"
  ),
});

export type FullEvaluation = z.infer<typeof FullEvaluationSchema>;

// Schema for the response from analyzeRubricCriterion
export const AnalyzeRubricCriterionResponseSchema = z.object({
  analysis: AnalysisResultSchema.describe("The AI analysis result"),
  submissionPath: z.string().describe("Path to the submission directory"),
  fileSystemTree: z
    .array(z.string())
    .describe("File system tree structure as array of file paths"),
  textSubmission: z
    .string()
    .nullable()
    .optional()
    .describe("Text submission content if available"),
});

export type AnalyzeRubricCriterionResponse = z.infer<
  typeof AnalyzeRubricCriterionResponseSchema
>;
