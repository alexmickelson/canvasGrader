import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from "axios";
import dotenv from "dotenv";
import { promises as fs } from "fs";
import path from "path";
import type { CanvasSubmission } from "./canvasModels.js";
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
          submissionId: submission.id,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to download attachment '${name}': ${msg}`);
      }
    })
  );
}

// High-level utility function to download all attachments for a submission with full Canvas integration
export const downloadAllAttachmentsUtil = async (params: {
  courseId: number;
  assignmentId: number;
  userId: number;
  attachmentsDir: string;
}): Promise<DownloadedAttachment[]> => {
  const { courseId, assignmentId, userId, attachmentsDir } = params;

  const { data: submission } = await rateLimitAwareGet<CanvasSubmission>(
    `${baseCanvasUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
    {
      headers: canvasRequestOptions.headers,
      params: { include: ["attachments", "user", "submission_comments"] },
    }
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
  submission: CanvasSubmission,
  targetDir: string
): Promise<DownloadedAttachment[]> {
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
            claimedType || headerType
          );

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
            `Failed to download comment attachment '${name}': ${msg}`
          );
        }
      });
    })
  );

  return results.filter((result) => result !== null);
}

// Download embedded attachments from submission body HTML
export async function downloadEmbeddedAttachments(
  submission: CanvasSubmission,
  targetDir: string
): Promise<DownloadedAttachment[]> {
  const submissionBody = submission.body;
  if (!submissionBody) {
    console.log("No submission body to extract embedded attachments from");
    return [];
  }

  // Extract file links from HTML using regex
  // Looking for instructure_file_link anchors with href and data-api-endpoint
  const linkRegex =
    /<a[^>]*class="[^"]*instructure_file_link[^"]*"[^>]*href="([^"]+)"[^>]*data-api-endpoint="([^"]+)"[^>]*>([^<]+)<\/a>/g;

  const matches = [...submissionBody.matchAll(linkRegex)];

  if (matches.length === 0) {
    // console.log("No embedded file links found in submission body");
    return [];
  }

  // console.log(`Found ${matches.length} embedded file links`);

  return await Promise.all(
    matches.map(async (match) => {
      const [, , apiEndpoint, fileName] = match;

      try {
        // Get file metadata from API endpoint
        const { data: fileData } = await rateLimitAwareGet<{
          id: number;
          url: string;
          "content-type": string;
          display_name: string;
          filename: string;
        }>(apiEndpoint, {
          headers: canvasRequestOptions.headers,
        });

        // Download the actual file
        const resp = await rateLimitAwareGet<ArrayBuffer>(fileData.url, {
          headers: canvasRequestOptions.headers,
          responseType: "arraybuffer",
        });

        const bytes = new Uint8Array(resp.data);
        const headerType =
          (resp.headers["content-type"] as string | undefined) || "";
        const claimedType = fileData["content-type"] || "";
        const contentType = sniffContentType(bytes, claimedType || headerType);

        const name = fileData.display_name || fileData.filename || fileName;

        // console.log(
        //   "Downloaded embedded attachment:",
        //   name,
        //   "type:",
        //   contentType || headerType,
        //   "size:",
        //   bytes.length
        // );

        // Save the attachment to the target directory
        const sanitizedName = name.replace(/[^a-z0-9._-]/gi, "_");
        const uniqueName = `embeded-${fileData.id}-${sanitizedName}`;
        const attachmentPath = path.join(targetDir, uniqueName);
        await fs.writeFile(attachmentPath, bytes);
        // console.log("Saved embedded attachment to:", attachmentPath);

        return {
          id: fileData.id,
          name,
          url: fileData.url,
          contentType: contentType || headerType || claimedType || "",
          bytes,
          filepath: attachmentPath,
          submissionId: submission.id,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `Failed to download embedded attachment '${fileName}': ${msg}`
        );
        // Return null instead of throwing to allow other downloads to continue
        return null;
      }
    })
  ).then((results) => results.filter((result) => result !== null));
}
