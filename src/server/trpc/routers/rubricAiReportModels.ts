import z from "zod";

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
    .array(
      z.object({
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
          .describe("Code ranges with precise line and column information"),
        description: z
          .string()
          .describe(
            "Explanation of how this evidence relates to the criterion"
          ),
      })
    )
    .describe("Array of evidence found in the submission files"),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
