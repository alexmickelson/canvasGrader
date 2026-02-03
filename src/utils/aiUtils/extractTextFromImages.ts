import fs from "fs";
import path from "path";
import pdf2pic from "pdf2pic";
import { getAiCompletion } from "./getAiCompletion";
import type { ConversationMessage } from "../../server/trpc/routers/generalAi/generalAiModels";

const imageModel = process.env.AI_IMAGE_MODEL || "";

export interface PageTranscription {
  pageNumber: number;
  transcription: string;
  pngFileName: string;
}

// Helper function to store a transcription page as markdown
export async function storeTranscriptionPage(
  pdfPath: string,
  pageNumber: number,
  transcription: string,
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
      writeError,
    );
  }
}

// Helper function to transcribe an image using AI vision
async function transcribeImageWithAI(
  base64Image: string,
  mediaType: string,
  imageName: string,
  userPrompt: string,
): Promise<string> {
  try {
    console.log(`Transcribing: ${imageName}`);

    const systemMessage: ConversationMessage = {
      role: "system",
      content: [
        {
          type: "text",
          text: `You are a document transcription assistant.
Your task is to transcribe images to clean, well-formatted Markdown.
Include all text content, preserve structure with headers, lists, code blocks, tables, etc.
If there are images or diagrams, describe them briefly in [brackets].
Be accurate and maintain the original formatting as much as possible.

After the transcription, add a section describing the parts of the image that are not representable in text, such as diagrams, drawings, or complex formatting.
Provide a brief summary of these elements to give context to the transcription.

Use clearly marked headings to separate sections of the transcription.
`,
        },
      ],
    };

    const userMessage: ConversationMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: userPrompt,
        },
        {
          type: "image_url",
          image_url: {
            base64: base64Image,
            mediaType,
          },
        },
      ],
    };

    const response = await getAiCompletion({
      messages: [systemMessage, userMessage],
      model: imageModel,
    });

    const aiResponse =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content.find((item) => item.type === "text")?.text
          : undefined;

    if (aiResponse) {
      console.log(`Successfully transcribed: ${imageName}`);
      return aiResponse;
    } else {
      console.warn(`No transcription received for: ${imageName}`);
      throw new Error(
        `No transcription received from AI service for: ${imageName} ${mediaType}`,
      );
    }
  } catch (error) {
    console.error(`Error transcribing ${imageName}:`, error);
    throw error;
  }
}

// Helper function to extract text from a single image file using AI vision
export async function extractTextFromImage(imagePath: string): Promise<string> {
  try {
    // Read the image file as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    // Determine media type based on file extension
    const ext = path.extname(imagePath).toLowerCase();
    const mediaType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".gif"
            ? "image/gif"
            : ext === ".webp"
              ? "image/webp"
              : "image/png";

    // Use shared transcription logic
    return await transcribeImageWithAI(
      base64Image,
      mediaType,
      path.basename(imagePath),
      "Please transcribe this image.",
    );
  } catch (error) {
    console.error(`Error processing image ${imagePath}:`, error);
    throw new Error(
      `[Error: Failed to process image: ${path.basename(imagePath)}]`,
    );
  }
}

// Helper function to extract text from PDF files using AI vision, returning array of transcriptions
export async function extractTextFromPdf(
  pdfPath: string,
): Promise<PageTranscription[]> {
  try {
    // Create a random temporary directory in /tmp
    const tempDir = path.join(
      "/tmp",
      `pdf-convert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    );
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`Created temporary directory: ${tempDir}`);

    // Convert PDF to PNG images using pdf2pic with aspect ratio preservation
    const pdfBasename = path.basename(pdfPath, ".pdf");
    const convert = pdf2pic.fromPath(pdfPath, {
      density: 150,
      saveFilename: `${pdfBasename}-page`,
      savePath: tempDir,
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

      // Use shared transcription logic with page-specific prompt and logging
      const pngFileName = path.basename(result.path);
      const pageNumber = i + 1;

      console.log(`Processing page ${pageNumber} of PDF: ${pdfPath}`);

      const transcription = await transcribeImageWithAI(
        base64Png,
        "image/png",
        `${pngFileName} (page ${pageNumber})`,
        `Please transcribe this page (${pageNumber}) from a PDF document.`,
      );

      if (transcription && !transcription.startsWith("[Error:")) {
        pageTranscriptions.push({
          pageNumber,
          transcription,
          pngFileName,
        });
        console.log(
          `Successfully transcribed page ${pageNumber}: ${pngFileName}`,
        );
      } else {
        console.warn(`Failed to transcribe page ${pageNumber}: ${pngFileName}`);
      }
    }

    // Clean up the temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`Cleaned up temporary directory: ${tempDir}`);
    } catch (cleanupError) {
      console.warn(
        `Could not clean up temporary directory: ${tempDir}`,
        cleanupError,
      );
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
  pageTranscriptions: PageTranscription[],
): string {
  if (pageTranscriptions.length === 0) {
    return `[Error: No transcription received from AI service for PDF: ${path.basename(
      pdfPath,
    )}]`;
  }

  // Combine all page transcriptions
  const combinedPages = pageTranscriptions
    .map(
      (page) =>
        `=== Page ${page.pageNumber} (${page.pngFileName}) ===\n${page.transcription}`,
    )
    .join("\n\n");

  // Add line numbers to the transcription for better referencing
  const lines = combinedPages.split("\n");
  const numberedText = lines
    .map((line: string, index: number) => `${index + 1}: ${line}`)
    .join("\n");

  return `=== PDF Transcription (${path.basename(
    pdfPath,
  )}) ===\n${numberedText}`;
}
