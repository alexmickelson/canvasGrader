import z from "zod";

// Schema for evidence in analysis results
export const EvidenceSchema = z.object({
  fileName: z
    .string()
    .describe(
      "Name of the file containing evidence, only source files, not directories"
    ),
  lineNumbers: z
    .object({
      start: z.object({
        line: z.number().min(0).describe("Starting line number"),
        column: z.number().min(0).describe("Starting column number"),
      }),
      end: z.object({
        line: z.number().min(0).describe("Ending line number"),
        column: z.number().min(0).describe("Ending column number"),
      }),
    })
    .nullable()
    .describe("Code ranges with precise line and column information"),
  description: z
    .string()
    .describe("Explanation of how this evidence relates to the criterion"),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

// Define structured output schema for AI analysis
export const AnalysisResultSchema = z.object({
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("Confidence level (0-100) in this assessment"),
  recommendedPoints: z
    .number()
    .min(0)
    .describe("Recommended points to award for this criterion"),
  description: z.string().describe("brief explanation of the assessment"),
  evidence: z
    .array(EvidenceSchema)
    .describe("Array of evidence found in the submission files"),
});

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
            .optional(),
        })
      ),
    ])
    .optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
  tool_call_id: z.string().optional(),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

// Schema for full evaluation data
export const FullEvaluationSchema = z.object({
  filePath: z.string().describe("Full path to the evaluation file"),
  fileName: z.string().describe("Name of the evaluation file"),
  metadata: EvaluationMetadataSchema.describe("Evaluation metadata"),
  conversation: z
    .array(ConversationMessageSchema)
    .describe("Complete conversation history with AI"),
  evaluation: AnalysisResultSchema.describe(
    "Structured analysis result from AI"
  ),
  submissionPath: z.string().describe("Path to the original submission files"),
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
    .describe("Text submission content if available"),
});

export type AnalyzeRubricCriterionResponse = z.infer<
  typeof AnalyzeRubricCriterionResponseSchema
>;
