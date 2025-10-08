import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from "axios";
import dotenv from "dotenv";
import { promises as fs } from "fs";
import path from "path";
import fs_sync from "fs";
import type { CanvasSubmissionComment } from "./canvasModels.js";
import { rateLimitAwareGet } from "./canvasRequestUtils.js";

dotenv.config();

export const baseCanvasUrl = "https://snow.instructure.com";
export const canvasApi = baseCanvasUrl + "/api/v1";
export const canvasRequestOptions = {
  headers: {
    Authorization: `Bearer ${process.env.CANVAS_TOKEN}`,
  },
};

function isAxiosHeaders(
  h: AxiosResponseHeaders | RawAxiosResponseHeaders
): h is AxiosResponseHeaders {
  return typeof (h as AxiosResponseHeaders).get === "function";
}

const getNextUrl = (
  headers: AxiosResponseHeaders | RawAxiosResponseHeaders
): string | undefined => {
  let linkHeader: string | undefined;
  if (isAxiosHeaders(headers)) {
    const val = headers.get("link");
    linkHeader = typeof val === "string" ? val : undefined;
  } else {
    linkHeader = (headers as RawAxiosResponseHeaders)["link"] as
      | string
      | undefined;
  }

  if (!linkHeader) {
    // No pagination header present
    return undefined;
  }

  const links = linkHeader.split(",").map((link) => link.trim());
  const nextLink = links.find((link) => link.includes('rel="next"'));

  if (!nextLink) {
    return undefined;
  }

  const nextUrl = nextLink.split(";")[0].trim().slice(1, -1);
  return nextUrl;
};

export async function paginatedRequest<T extends unknown[]>({
  url: urlParam,
  params = {},
}: {
  url: string;
  params?: { [key: string]: string | number | boolean | string[] };
}): Promise<T> {
  let requestCount = 1;
  const url = new URL(urlParam);
  url.searchParams.set("per_page", "100");
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // Handle array parameters like include[] for Canvas API
      // Ensure the key has [] brackets for Canvas API array parameters
      const arrayKey = key.endsWith("[]") ? key : `${key}[]`;
      value.forEach((item) => {
        url.searchParams.append(arrayKey, item.toString());
      });
    } else {
      url.searchParams.set(key, value.toString());
    }
  });

  const returnData: unknown[] = [];
  let nextUrl: string | undefined = url.toString();
  console.log(nextUrl);

  while (nextUrl) {
    const { data, headers } = await rateLimitAwareGet<T>(
      nextUrl,
      canvasRequestOptions
    );

    if (data) {
      returnData.push(...(data as unknown[]));
    }

    nextUrl = getNextUrl(headers);
    requestCount += 1;
  }

  if (requestCount > 1) {
    console.log(
      `Requesting ${typeof returnData} took ${requestCount} requests`
    );
  }

  return returnData as T;
}

// Lightweight attachment shape used by download utilities
export type CanvasAttachmentLite = {
  id: number;
  filename?: string;
  display_name?: string;
  content_type?: string;
  url: string;
};

export type SubmissionWithAttachmentsLike = {
  attachments?: CanvasAttachmentLite[] | undefined | null;
};

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
  id: number | undefined;
  name: string;
  url: string;
  contentType: string;
  bytes: Uint8Array;
};

// Download all attachments on a submission and return bytes with corrected content types
export async function downloadSubmissionAttachments(
  submission: SubmissionWithAttachmentsLike
): Promise<DownloadedAttachment[]> {
  const attachments = submission.attachments ?? [];
  const results: DownloadedAttachment[] = [];

  for (const att of attachments) {
    const name = att.display_name || att.filename || `file-${att.id}`;
    try {
      const resp = await rateLimitAwareGet<ArrayBuffer>(att.url, {
        // Some Canvas pre-signed URLs don't require auth, but header won't hurt
        headers: canvasRequestOptions.headers,
        responseType: "arraybuffer",
      });
      const bytes = new Uint8Array(resp.data);
      const headerType =
        (resp.headers["content-type"] as string | undefined) || "";
      const claimedType = att.content_type || "";
      const contentType = sniffContentType(bytes, claimedType || headerType);
      console.log(
        "downloaded file ",
        name,
        "type:",
        contentType || headerType,
        "url",
        att.url
      );

      results.push({
        id: att.id,
        name,
        url: att.url,
        contentType: contentType || headerType || claimedType || "",
        bytes,
      });
    } catch (err) {
      // Re-throw with filename context; router will decide whether/how to map to TRPC error
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to download attachment '${name}': ${msg}`);
    }
  }

  return results;
}

// Download all attachments on a submission and save them to a specific folder structure
export async function downloadSubmissionAttachmentsToFolder(
  submission: SubmissionWithAttachmentsLike,
  targetDir: string
): Promise<DownloadedAttachment[]> {
  const attachments = submission.attachments ?? [];
  const results: DownloadedAttachment[] = [];

  for (const att of attachments) {
    const name = att.display_name || att.filename || `file-${att.id}`;
    try {
      const resp = await rateLimitAwareGet<ArrayBuffer>(att.url, {
        headers: canvasRequestOptions.headers,
        responseType: "arraybuffer",
      });
      const bytes = new Uint8Array(resp.data);
      const headerType =
        (resp.headers["content-type"] as string | undefined) || "";
      const claimedType = att.content_type || "";
      const contentType = sniffContentType(bytes, claimedType || headerType);

      console.log(
        "Downloaded attachment:",
        name,
        "type:",
        contentType || headerType,
        "size:",
        bytes.length
      );

      // Save the attachment to the target directory with unique naming
      const sanitizedName = name.replace(/[^a-z0-9._-]/gi, "_");
      const uniqueName = `${att.id || Date.now()}-${sanitizedName}`;
      const attachmentPath = path.join(targetDir, uniqueName);
      await fs.writeFile(attachmentPath, bytes);
      console.log("Saved attachment to:", attachmentPath);

      results.push({
        id: att.id,
        name,
        url: att.url,
        contentType: contentType || headerType || claimedType || "",
        bytes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to download attachment '${name}': ${msg}`);
    }
  }

  return results;
}

// Helper function to check if a submission should be ignored
export const isTestStudentSubmission = (submission: {
  user?: { name?: string };
}) => {
  return submission.user?.name === "Test Student";
};

// High-level utility function to download all attachments for a submission with full Canvas integration
export const downloadAllAttachmentsUtil = async (params: {
  courseId: number;
  assignmentId: number;
  userId: number;
}) => {
  const { courseId, assignmentId, userId } = params;

  // Fetch the submission with attachments and user data
  type SubmissionWithAttachments = {
    id?: number;
    attachments?: CanvasAttachmentLite[];
    body?: string;
    submission_type?: string;
    user?: {
      id: number;
      name: string;
    };
  };

  const { data: submission } =
    await rateLimitAwareGet<SubmissionWithAttachments>(
      `${baseCanvasUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
      {
        headers: canvasRequestOptions.headers,
        params: { include: ["attachments", "user", "submission_comments"] },
      }
    );

  console.log("Submission data:", submission);

  // Skip processing for Test Student submissions
  if (isTestStudentSubmission(submission)) {
    console.log("Skipping Test Student submission");
    return null;
  }

  const attachments = submission.attachments ?? [];
  const hasTextEntry = submission.body && submission.body.trim();

  if (!attachments.length && !hasTextEntry) {
    console.log(
      "No attachments or text entry found for this submission, returning null"
    );
    return null;
  }

  // Get course, assignment, and user metadata for folder structure
  const { getCourseMeta } = await import("./canvasStorageUtils.js");
  const { courseName, termName } = await getCourseMeta(courseId);
  const { data: assignment } = await rateLimitAwareGet<{ name?: string }>(
    `${baseCanvasUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}`,
    {
      headers: canvasRequestOptions.headers,
    }
  );
  const assignmentName = assignment?.name || `Assignment ${assignmentId}`;
  const userName = submission.user?.name || `User ${userId}`;

  // Create folder structure and download attachments
  const { getSubmissionDirectory, ensureDir } = await import(
    "./canvasStorageUtils.js"
  );
  const submissionDir = getSubmissionDirectory({
    termName,
    courseName,
    assignmentId,
    assignmentName,
    studentName: userName,
  });

  const attachmentsDir = path.join(submissionDir, "attachments");
  ensureDir(attachmentsDir);

  if (!attachments.length) {
    console.log("No attachments to download for this submission");
    return null;
  }

  console.log("Downloading submission attachments to:", attachmentsDir);
  const downloaded = await downloadSubmissionAttachmentsToFolder(
    submission,
    attachmentsDir
  );

  // Save a manifest of downloaded attachments
  try {
    const manifestPath = path.join(attachmentsDir, "attachments.json");
    fs_sync.writeFileSync(
      manifestPath,
      JSON.stringify(downloaded, null, 2),
      "utf8"
    );
    console.log("Saved attachments manifest to:", manifestPath);
  } catch (err) {
    console.warn("Failed to write attachments manifest:", err);
  }

  const downloadedNames = downloaded.map((d) => d.name);
  console.log(`Downloaded ${downloadedNames.length} attachments`);

  return { downloaded: downloadedNames };
};

// Download all attachments from submission comments
export async function downloadCommentAttachments(
  submission: {
    submission_comments?: CanvasSubmissionComment[];
    user?: {
      name?: string;
    };
  },
  targetDir: string
): Promise<DownloadedAttachment[]> {
  const comments = submission.submission_comments ?? [];
  const results: DownloadedAttachment[] = [];

  for (const comment of comments) {
    const attachments = comment.attachments ?? [];

    for (const att of attachments) {
      if (!att.url) {
        console.warn(`Skipping attachment ${att.id} - no URL`);
        continue;
      }

      const name = att.display_name || att.filename || `comment-file-${att.id}`;
      try {
        const resp = await rateLimitAwareGet<ArrayBuffer>(att.url, {
          headers: canvasRequestOptions.headers,
          responseType: "arraybuffer",
        });
        const bytes = new Uint8Array(resp.data);
        const headerType =
          (resp.headers["content-type"] as string | undefined) || "";
        const claimedType = att["content-type"] || "";
        const contentType = sniffContentType(bytes, claimedType || headerType);

        console.log(
          "Downloaded comment attachment:",
          name,
          "from comment:",
          comment.id,
          "author:",
          comment.author_name,
          "type:",
          contentType || headerType
        );

        // Save with comment info in filename
        const sanitizedName = name.replace(/[^a-z0-9._-]/gi, "_");
        const uniqueName = `comment-${comment.id || "unknown"}-${
          att.id || Date.now()
        }-${sanitizedName}`;
        const attachmentPath = path.join(targetDir, uniqueName);
        await fs.writeFile(attachmentPath, bytes);
        console.log("Saved comment attachment to:", attachmentPath);

        results.push({
          id: att.id,
          name,
          url: att.url,
          contentType: contentType || headerType || claimedType || "",
          bytes,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Failed to download comment attachment '${name}': ${msg}`
        );
      }
    }
  }

  return results;
}
