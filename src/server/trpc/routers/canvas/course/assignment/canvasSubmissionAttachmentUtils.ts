import fs from "fs";
import path from "path";
import { rateLimitAwareGet } from "../../canvasRequestUtils.js";
import { canvasRequestOptions } from "../../canvasServiceUtils.js";
import {
  extractTextFromImage,
  extractTextFromPdf,
} from "../../../../../../utils/aiUtils/extractTextFromImages.js";
import {
  getSubmissionDirectory,
  sanitizeImageTitle,
} from "../../canvasStorageUtils.js";

export function getResponseFileExtension(
  bytes: Uint8Array,
  headerType: string,
  fallbackUrl?: string
): string {
  // Determine extension from content type or file header
  if (
    headerType.includes("image/png") ||
    (bytes[0] === 0x89 && bytes[1] === 0x50)
  ) {
    return ".png";
  } else if (
    headerType.includes("image/jpeg") ||
    headerType.includes("image/jpg") ||
    (bytes[0] === 0xff && bytes[1] === 0xd8)
  ) {
    return ".jpg";
  } else if (
    headerType.includes("image/gif") ||
    (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
  ) {
    return ".gif";
  } else if (headerType.includes("image/webp")) {
    return ".webp";
  } else if (
    headerType.includes("application/pdf") ||
    (bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46)
  ) {
    return ".pdf";
  } else {
    // Try to get extension from fallback URL
    if (fallbackUrl) {
      const urlExtension = path.extname(fallbackUrl);
      if (urlExtension) {
        return urlExtension;
      }
    }
    return ""; // final fallback
  }
}

// Extract images from markdown content
export function extractAttachmentsFromMarkdown(markdown: string): Array<{
  title: string;
  url: string;
  altText?: string;
}> {
  const images: Array<{ title: string; url: string; altText?: string }> = [];

  if (!markdown || !markdown.trim()) {
    return images;
  }

  // Regex to match markdown image syntax: ![alt text](url "optional title")
  // This handles both ![alt](url) and ![alt](url "title") formats
  const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

  let match;
  while ((match = imageRegex.exec(markdown)) !== null) {
    const [, altText, url, title] = match;

    images.push({
      title: title || altText || path.basename(url, path.extname(url)),
      url: url.trim(),
      altText: altText || undefined,
    });
  }

  // Also check for HTML img tags in case markdown contains raw HTML
  const htmlImageRegex =
    /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*(?:title=["']([^"']*)["'])?[^>]*\/?>/gi;

  while ((match = htmlImageRegex.exec(markdown)) !== null) {
    const [, url, altText, title] = match;

    // Avoid duplicates by checking if URL already exists
    if (!images.some((img) => img.url === url.trim())) {
      images.push({
        title: title || altText || path.basename(url, path.extname(url)),
        url: url.trim(),
        altText: altText || undefined,
      });
    }
  }

  return images;
}

// Download submission attachments
export async function dowloadSubmissionAttachments(
  images: {
    title: string;
    url: string;
  }[],
  {
    termName,
    courseName,
    assignmentId,
    assignmentName,
    studentName,
  }: {
    termName: string;
    courseName: string;
    assignmentId: number;
    assignmentName: string;
    studentName: string;
  }
): Promise<
  Array<{
    title: string;
    url: string;
    filePath: string;
  }>
> {
  console.log("dowloading submission images");
  const downloaded = await Promise.all(
    images.map(async (image, index) => {
      const metadataDir = getSubmissionDirectory({
        termName,
        courseName,
        assignmentId,
        assignmentName,
        studentName,
      });
      const attachmentsDir = metadataDir + "/attachments/"

      if (
        !image.url.startsWith("http://") &&
        !image.url.startsWith("https://")
      ) {
        console.log("could not download image, unsupported URL:", image.url);
        return null;
      }

      const sanitizedTitle = sanitizeImageTitle(image.title);
      const tempFileName = `submission.${index}.${sanitizedTitle}`;

      // Check if file already exists with any extension
      const existingFiles = fs
        .readdirSync(attachmentsDir)
        .filter((file) => file.startsWith(tempFileName));

      if (existingFiles.length > 0) {
        const existingFilePath = path.join(attachmentsDir, existingFiles[0]);

        return {
          title: image.title,
          url: image.url,
          filePath: existingFilePath,
        };
      }

      // Download from URL
      const response = await rateLimitAwareGet<ArrayBuffer>(image.url, {
        headers: canvasRequestOptions.headers,
        responseType: "arraybuffer",
      });

      const bytes = new Uint8Array(response.data);
      const headerType =
        (response.headers["content-type"] as string | undefined) || "";

      const extension = getResponseFileExtension(bytes, headerType, image.url);

      const fileName = `${tempFileName}${extension}`;
      const filePath = path.join(attachmentsDir, fileName);

      fs.writeFileSync(filePath, bytes);
      console.log(`Downloaded and saved: ${image.title} to ${filePath}`);

      return {
        title: image.title,
        url: image.url,
        filePath,
      };
    })
  );

  return downloaded.filter((item) => item !== null);
}

export async function transcribeSubmissionAttachments(
  imagesWithPaths: Array<{
    title: string;
    url: string;
    filePath: string;
  }>,
  {
    termName,
    courseName,
    assignmentId,
    assignmentName,
    studentName,
  }: {
    termName: string;
    courseName: string;
    assignmentId: number;
    assignmentName: string;
    studentName: string;
  }
) {
  const submissionDir = getSubmissionDirectory({
    termName,
    courseName,
    assignmentId,
    assignmentName,
    studentName,
  });

  console.log("Transcribing submission images", assignmentName, studentName);

  return (
    await Promise.all(
      imagesWithPaths.map(async (imageWithPath, index) => {
        try {
          const sanitizedTitle = sanitizeImageTitle(imageWithPath.title);
          const fileName = `submission.${index}.${sanitizedTitle}.md`;
          const transcriptionPath = path.join(submissionDir, fileName);

          // Check if transcription file already exists
          if (fs.existsSync(transcriptionPath)) {
            return null;
          }

          console.log(
            `Transcribing image: ${imageWithPath.title} at ${imageWithPath.filePath}`
          );

          // Determine if this is a PDF or image file
          const fileExtension = path
            .extname(imageWithPath.filePath)
            .toLowerCase();
          let transcription: string;

          if (fileExtension === ".pdf") {
            const pageTranscriptions = await extractTextFromPdf(
              imageWithPath.filePath
            );
            // Combine all page transcriptions into a single string
            transcription = pageTranscriptions
              .map(
                (page) =>
                  `=== Page ${page.pageNumber} ===\n${page.transcription}`
              )
              .join("\n\n");
          } else {
            // Handle as image file
            transcription = await extractTextFromImage(imageWithPath.filePath);
          }

          // fs.writeFileSync(transcriptionPath, transcription, "utf8");
          console.log(`Saved transcription to: ${transcriptionPath}`);
          return {
            index,
            fileName,
            transcription,
          };
        } catch (error) {
          console.error(
            `Error transcribing image ${imageWithPath.title}:`,
            error
          );
          return null;
        }
      })
    )
  ).filter((result) => result !== null);
}
