import path from "path";
import { rateLimitAwareGet } from "../../canvasRequestUtils.js";
import {
  baseCanvasUrl,
  canvasRequestOptions,
} from "../../canvasServiceUtils.js";
import {
  extractTextFromImage,
  extractTextFromPdf,
} from "../../../../../../utils/aiUtils/extractTextFromImages.js";
import {
  getSubmissionDirectory,
  sanitizeImageTitle,
} from "../../canvasStorageUtils.js";
import { promises as fs } from "fs";
import type {
  CanvasSubmission,
  SubmissionAttachment,
} from "../../canvasModels.js";

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
  },
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
      const attachmentsDir = metadataDir + "/attachments/";

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
      const existingFiles = (await fs.readdir(attachmentsDir)).filter((file) =>
        file.startsWith(tempFileName),
      );

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

      await fs.writeFile(filePath, bytes);
      console.log(`Downloaded and saved: ${image.title} to ${filePath}`);

      return {
        title: image.title,
        url: image.url,
        filePath,
      };
    }),
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
  },
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
          try {
            await fs.access(transcriptionPath);
            return null;
          } catch {
            // File does not exist, continue
          }

          console.log(
            `Transcribing image: ${imageWithPath.title} at ${imageWithPath.filePath}`,
          );

          // Determine if this is a PDF or image file
          const fileExtension = path
            .extname(imageWithPath.filePath)
            .toLowerCase();
          let transcription: string;

          if (fileExtension === ".pdf") {
            const pageTranscriptions = await extractTextFromPdf(
              imageWithPath.filePath,
            );
            // Combine all page transcriptions into a single string
            transcription = pageTranscriptions
              .map(
                (page) =>
                  `=== Page ${page.pageNumber} ===\n${page.transcription}`,
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
            error,
          );
          return null;
        }
      }),
    )
  ).filter((result) => result !== null);
}

export const downloadAllAttachmentsUtil = async (params: {
  courseId: number;
  assignmentId: number;
  userId: number;
  attachmentsDir: string;
}): Promise<SubmissionAttachment[]> => {
  const { courseId, assignmentId, userId, attachmentsDir } = params;

  const { data: submission } = await rateLimitAwareGet<CanvasSubmission>(
    `${baseCanvasUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
    {
      headers: canvasRequestOptions.headers,
      params: { include: ["attachments", "user", "submission_comments"] },
    },
  );

  // console.log("Submission data:", submission);

  // Skip processing for Test Student submissions
  if (submission.user?.name === "Test Student") {
    console.log("Skipping Test Student submission");
    return [];
  }

  console.log("Downloading submission attachments to:", attachmentsDir);
  const downloaded = await downloadSubmissionAttachmentsToFolder(
    submission,
    attachmentsDir,
  );
  console.log(`Downloaded ${downloaded.length} attachments`);

  return downloaded.map((att) => ({
    id: att.id,
    submission_id: att.submissionId,
    filepath: att.filepath,
    type: "uploaded" as const,
    ai_transcription: null,
  }));
};

export async function downloadCommentAttachments(
  submission: CanvasSubmission,
  targetDir: string,
): Promise<SubmissionAttachment[]> {
  const comments = submission.submission_comments ?? [];

  const results = await Promise.all(
    comments.flatMap((comment) => {
      const attachments = comment.attachments ?? [];

      return attachments.map(async (att) => {
        if (!att.url) {
          console.warn(`Skipping attachment ${att.id} - no URL`);
          return null;
        }

        const name =
          att.display_name || att.filename || `comment-file-${att.id}`;
        try {
          const resp = await rateLimitAwareGet<ArrayBuffer>(att.url, {
            headers: canvasRequestOptions.headers,
            responseType: "arraybuffer",
          });
          const bytes = new Uint8Array(resp.data);
          const headerType =
            (resp.headers["content-type"] as string | undefined) || "";
          const claimedType = att["content-type"] || "";
          const contentType = sniffContentType(
            bytes,
            claimedType || headerType,
          );

          console.log(
            "Downloaded comment attachment:",
            name,
            "from comment:",
            comment.id,
            "author:",
            comment.author_name,
            "type:",
            contentType || headerType,
          );

          // Save with comment info in filename
          const sanitizedName = name.replace(/[^a-z0-9._-]/gi, "_");
          const uniqueName = `comment-${comment.id || "unknown"}-${
            att.id || Date.now()
          }-${sanitizedName}`;
          const attachmentPath = path.join(targetDir, uniqueName);
          await fs.writeFile(attachmentPath, bytes);
          console.log("Saved comment attachment to:", attachmentPath);

          return {
            id: att.id,
            name,
            url: att.url,
            contentType: contentType || headerType || claimedType || "",
            bytes,
            filepath: attachmentPath,
            submissionId: submission.id,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(
            `Failed to download comment attachment '${name}': ${msg}`,
          );
        }
      });
    }),
  );

  return results
    .filter((result) => result !== null)
    .map((att) => ({
      id: att.id,
      submission_id: att.submissionId,
      filepath: att.filepath,
      type: "comment" as const,
      ai_transcription: null,
    }));
}

// Download embedded attachments from submission body HTML
export async function downloadEmbeddedAttachments(
  submission: CanvasSubmission,
  targetDir: string,
): Promise<SubmissionAttachment[]> {
  const submissionBody = submission.body;
  if (!submissionBody) {
    console.log("No submission body to extract embedded attachments from");
    return [];
  }

  const attachments = extractAttachmentsFromSubmission(submissionBody);
  if (attachments.length === 0) {
    return [];
  }

  return await Promise.all(
    attachments.map(async ({ url, title }) => {
      const resp = await rateLimitAwareGet<ArrayBuffer>(url, {
        headers: canvasRequestOptions.headers,
        responseType: "arraybuffer",
      });

      const bytes = new Uint8Array(resp.data);
      const headerType =
        (resp.headers["content-type"] as string | undefined) || "";
      const contentType = sniffContentType(bytes, headerType);

      const name = title || path.basename(url);

      const sanitizedName = name.replace(/[^a-z0-9._-]/gi, "_");
      const uniqueName = `embedded-${sanitizedName}`;
      const attachmentPath = path.join(targetDir, uniqueName);
      await fs.writeFile(attachmentPath, bytes);
      const id = parseInt(url.match(/\/(\d+)/)?.[1] || String(Date.now()));

      return {
        id,
        name,
        url,
        contentType: contentType || headerType || "",
        bytes,
        filepath: attachmentPath,
        submissionId: submission.id,
      };
    }),
  ).then((results) =>
    results.map((att) => ({
      id: att.id,
      submission_id: att.submissionId,
      filepath: att.filepath,
      type: "embedded" as const,
      ai_transcription: null,
    })),
  );
}

// Sniff common binary signatures to correct mislabeled content types
export function sniffContentType(bytes: Uint8Array, fallback?: string): string {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 ...
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  // PDF: %PDF-
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }
  return fallback || "";
}

export type DownloadedAttachment = {
  id: number;
  submissionId: number;
  name: string;
  url: string;
  contentType: string;
  bytes: Uint8Array;
  filepath: string;
};

export async function downloadSubmissionAttachmentsToFolder(
  submission: CanvasSubmission,
  targetDir: string,
): Promise<DownloadedAttachment[]> {
  const attachments = submission.attachments ?? [];

  return await Promise.all(
    attachments.map(async (att) => {
      const name = att.display_name || att.filename || `file-${att.id}`;
      const resp = await rateLimitAwareGet<ArrayBuffer>(att.url, {
        headers: canvasRequestOptions.headers,
        responseType: "arraybuffer",
      });
      const bytes = new Uint8Array(resp.data);
      const headerType =
        (resp.headers["content-type"] as string | undefined) || "";
      const claimedType = att.content_type || "";
      const contentType = sniffContentType(bytes, claimedType || headerType);

      const sanitizedName = name.replace(/[^a-z0-9._-]/gi, "_");
      const uniqueName = `${att.id || Date.now()}-${sanitizedName}`;
      const attachmentPath = path.join(targetDir, uniqueName);
      await fs.writeFile(attachmentPath, bytes);
      console.log("Saved attachment to:", attachmentPath);

      return {
        id: att.id,
        name,
        url: att.url,
        contentType: contentType || headerType || claimedType || "",
        bytes,
        filepath: attachmentPath,
        submissionId: submission.id,
      };
    }),
  );
}

export function getResponseFileExtension(
  bytes: Uint8Array,
  headerType: string,
  fallbackUrl?: string,
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

export function extractAttachmentsFromSubmission(markdown: string): Array<{
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

    // Check if altText has a file extension
    const hasFileExtension =
      altText && /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|pdf)$/i.test(altText);
    const finalTitle =
      title ||
      (hasFileExtension ? altText : undefined) ||
      altText ||
      path.basename(url, path.extname(url));

    images.push({
      title: finalTitle,
      url: url.trim(),
      altText: altText || undefined,
    });
  }

  // Also check for HTML img tags in case markdown contains raw HTML
  const htmlImageRegex =
    /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*(?:title=["']([^"']*)["'])?[^>]*\/?>/gi;

  while ((match = htmlImageRegex.exec(markdown)) !== null) {
    const fullMatch = match[0];
    const url = match[1];

    // Extract alt attribute separately to handle order
    const altMatch = /alt=["']([^"']*)["']/i.exec(fullMatch);
    const altText = altMatch ? altMatch[1] : undefined;

    // Extract title attribute
    const titleMatch = /title=["']([^"']*)["']/i.exec(fullMatch);
    const title = titleMatch ? titleMatch[1] : undefined;

    // Avoid duplicates by checking if URL already exists
    if (!images.some((img) => img.url === url.trim())) {
      // Check if altText has a file extension
      const hasFileExtension =
        altText && /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|pdf)$/i.test(altText);
      const finalTitle =
        title ||
        (hasFileExtension ? altText : undefined) ||
        altText ||
        path.basename(url, path.extname(url));

      images.push({
        title: finalTitle,
        url: url.trim(),
        altText: altText || undefined,
      });
    }
  }

  return images;
}

export async function transcribeSubmissionAttachment(
  attachment: SubmissionAttachment,
): Promise<string> {
  if (attachment.ai_transcription) {
    return attachment.ai_transcription;
  }

  const fileExtension = path.extname(attachment.filepath).toLowerCase();
  let transcription: string;

  if (fileExtension === ".pdf") {
    const pageTranscriptions = await extractTextFromPdf(attachment.filepath);
    transcription = pageTranscriptions
      .map((page) => `=== Page ${page.pageNumber} ===\n${page.transcription}`)
      .join("\n\n");
  } else {
    transcription = await extractTextFromImage(attachment.filepath);
  }

  return transcription;
}
