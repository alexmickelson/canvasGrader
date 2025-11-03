import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from "axios";
import dotenv from "dotenv";
import { promises as fs } from "fs";
import path from "path";
import type {
  CanvasSubmission,
  CanvasSubmissionComment,
} from "./canvasModels.js";
import { rateLimitAwareGet } from "./canvasRequestUtils.js";
import { ensureDir, getSubmissionDirectory } from "./canvasStorageUtils.js";

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
  filepath: string;
};

// Download all attachments on a submission and save them to a specific folder structure
export async function downloadSubmissionAttachmentsToFolder(
  submission: CanvasSubmission,
  targetDir: string
): Promise<DownloadedAttachment[]> {
  const attachments = submission.attachments ?? [];

  return await Promise.all(
    attachments.map(async (att) => {
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

        return {
          id: att.id,
          name,
          url: att.url,
          contentType: contentType || headerType || claimedType || "",
          bytes,
          filepath: attachmentPath,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to download attachment '${name}': ${msg}`);
      }
    })
  );
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
  courseName: string;
  assignmentName: string;
  studentName: string;
  termName: string;
}): Promise<DownloadedAttachment[]> => {
  const {
    courseId,
    assignmentId,
    userId,
    assignmentName,
    studentName,
    termName,
    courseName,
  } = params;

  const { data: submission } = await rateLimitAwareGet<CanvasSubmission>(
    `${baseCanvasUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
    {
      headers: canvasRequestOptions.headers,
      params: { include: ["attachments", "user", "submission_comments"] },
    }
  );

  // console.log("Submission data:", submission);

  // Skip processing for Test Student submissions
  if (isTestStudentSubmission(submission)) {
    console.log("Skipping Test Student submission");
    return [];
  }

  const submissionDir = getSubmissionDirectory({
    termName,
    courseName,
    assignmentId,
    assignmentName,
    studentName,
  });

  const attachmentsDir = path.join(submissionDir, "attachments");
  ensureDir(attachmentsDir);

  console.log("Downloading submission attachments to:", attachmentsDir);
  const downloaded = await downloadSubmissionAttachmentsToFolder(
    submission,
    attachmentsDir
  );

  // Save a manifest of downloaded attachments
  // try {
  //   const manifestPath = path.join(attachmentsDir, "attachments.json");
  //   fs_sync.writeFileSync(
  //     manifestPath,
  //     JSON.stringify(downloaded, null, 2),
  //     "utf8"
  //   );
  //   console.log("Saved attachments manifest to:", manifestPath);
  // } catch (err) {
  //   console.warn("Failed to write attachments manifest:", err);
  // }

  console.log(`Downloaded ${downloaded.length} attachments`);

  return downloaded;
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
          filepath: attachmentPath,
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
