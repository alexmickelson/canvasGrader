import fs from "fs";
import path from "path";
import pdf2pic from "pdf2pic";
import { getAiCompletion } from "./getAiCompletion";
import type { ConversationMessage } from "../../server/trpc/routers/rubricAI/rubricAiReportModels";

export interface PageTranscription {
  pageNumber: number;
  transcription: string;
  pngFileName: string;
}

// Helper function to store a transcription page as markdown
export async function storeTranscriptionPage(
  pdfPath: string,
  pageNumber: number,
  transcription: string
) {
  try {
    const pdfBasename = path.basename(pdfPath, ".pdf");
    const markdownFileName = `${pdfBasename}-page${pageNumber}.md`;
    const markdownPath = path.join(path.dirname(pdfPath), markdownFileName);

    fs.writeFileSync(markdownPath, transcription, "utf-8");
    console.log(`Saved transcription to: ${markdownFileName}`);
  } catch (writeError) {
    console.warn(
      `Could not save markdown file for page ${pageNumber}:`,
      writeError
    );
  }
}

// Helper function to extract text from PDF files using AI vision, returning array of transcriptions
export async function extractTextFromPdf(
  pdfPath: string
): Promise<PageTranscription[]> {
  try {
    // Convert PDF to PNG images using pdf2pic with aspect ratio preservation
    const pdfBasename = path.basename(pdfPath, ".pdf");
    const convert = pdf2pic.fromPath(pdfPath, {
      density: 150,
      saveFilename: `${pdfBasename}-page`,
      savePath: path.dirname(pdfPath),
      format: "png",
      height: 1024,
    });

    const results = await convert.bulk(-1, { responseType: "image" });

    // Process each page image
    const pageTranscriptions: PageTranscription[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result.path) continue;

      // Read the generated PNG file as base64
      const pngBuffer = fs.readFileSync(result.path);
      const base64Png = pngBuffer.toString("base64");

      // Use getAiCompletion to transcribe the PNG image
      console.log(`Transcribing page ${i + 1} of PDF: ${pdfPath}`);

      const message: ConversationMessage = {
        role: "user",
        content: [
          {
            type: "text",
            text: `Please transcribe this page (${
              i + 1
            }) from a PDF document to clean, well-formatted Markdown. Include all text content, preserve structure with headers, lists, code blocks, tables, etc. If there are images or diagrams, describe them briefly in [brackets].`,
          },
          {
            type: "image_url",
            image_url: {
              base64: base64Png,
              mediaType: "image/png",
            },
          },
        ],
      };

      const response = await getAiCompletion({
        messages: [message],
      });

      const aiResponse =
        typeof response.content === "string"
          ? response.content
          : Array.isArray(response.content)
          ? response.content.find((item) => item.type === "text")?.text
          : undefined;
      if (aiResponse) {
        const pngFileName = path.basename(result.path);

        pageTranscriptions.push({
          pageNumber: i + 1,
          transcription: aiResponse,
          pngFileName,
        });
      }

      // Keep the PNG file instead of deleting it
      console.log(`Converted page ${i + 1} to: ${path.basename(result.path)}`);
    }

    return pageTranscriptions;
  } catch (error) {
    console.error(`Error transcribing PDF ${pdfPath}:`, error);
    // Return empty array on error instead of string
    return [];
  }
}

// Helper function to combine page transcriptions into a single string (for backward compatibility)
export function combinePageTranscriptions(
  pdfPath: string,
  pageTranscriptions: PageTranscription[]
): string {
  if (pageTranscriptions.length === 0) {
    return `[Error: No transcription received from AI service for PDF: ${path.basename(
      pdfPath
    )}]`;
  }

  // Combine all page transcriptions
  const combinedPages = pageTranscriptions
    .map(
      (page) =>
        `=== Page ${page.pageNumber} (${page.pngFileName}) ===\n${page.transcription}`
    )
    .join("\n\n");

  // Add line numbers to the transcription for better referencing
  const lines = combinedPages.split("\n");
  const numberedText = lines
    .map((line: string, index: number) => `${index + 1}: ${line}`)
    .join("\n");

  return `=== PDF Transcription (${path.basename(
    pdfPath
  )}) ===\n${numberedText}`;
}
