import type {
  AxiosError,
  AxiosResponse,
  AxiosResponseHeaders,
  RawAxiosResponseHeaders,
} from "axios";
import { axiosClient } from "../../../utils/axiosUtils";
import dotenv from "dotenv";
import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

dotenv.config();

export const baseCanvasUrl = "https://snow.instructure.com";
export const canvasApi = baseCanvasUrl + "/api/v1";
export const canvasRequestOptions = {
  headers: {
    Authorization: `Bearer ${process.env.CANVAS_TOKEN}`,
  },
};

const rateLimitRetryCount = 6;
const rateLimitSleepInterval = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isRateLimited = (response: AxiosResponse) => {
  if ((response.data + "").toLowerCase().includes("rate limit exceeded")) {
    console.log(
      "detected rate limit exceeded in response data",
      response.config?.url
    );
    return true;
  }

  return false;
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

export async function rateLimitGet<T>(
  url: string,
  options: object,
  maxRetries: number = rateLimitRetryCount,
  sleepInterval: number = rateLimitSleepInterval,
  retryCount: number = 0
): Promise<{ data: T; headers: RawAxiosResponseHeaders }> {
  try {
    const response = await axiosClient.get<T>(url, options);
    return { data: response.data, headers: response.headers };
  } catch (error) {
    const axiosError = error as AxiosError & {
      response?: { status: number; headers: RawAxiosResponseHeaders };
    };

    if (axiosError.response && isRateLimited(axiosError.response)) {
      if (retryCount < maxRetries) {
        console.info(
          `Hit rate limit, retry count is ${retryCount} / ${maxRetries}, retrying`
        );
        await sleep(sleepInterval);
        return rateLimitGet<T>(
          url,
          options,
          maxRetries,
          sleepInterval,
          retryCount + 1
        );
      } else {
        console.error(
          `Rate limit exceeded after ${maxRetries} retries, aborting request`
        );
        throw error;
      }
    } else {
      throw error; // Re-throw non-rate-limit errors
    }
  }
}

export async function paginatedRequest<T extends unknown[]>({
  url: urlParam,
  params = {},
}: {
  url: string;
  params?: { [key: string]: string | number | boolean };
}): Promise<T> {
  let requestCount = 1;
  const url = new URL(urlParam);
  url.searchParams.set("per_page", "100");
  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value.toString());
  });

  const returnData: unknown[] = [];
  let nextUrl: string | undefined = url.toString();

  while (nextUrl) {
    const { data, headers } = await rateLimitGet<T>(
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
      const resp = await axiosClient.get<ArrayBuffer>(att.url, {
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

      // Debug: persist PNG to ./storage for inspection
      if (contentType === "image/png") {
        try {
          const storageDir = path.resolve(process.cwd(), "storage");
          await fs.mkdir(storageDir, { recursive: true });
          const safeBase = (name || "attachment.png").replace(
            /[^a-z0-9._-]/gi,
            "_"
          );
          const hasPngExt = /\.png$/i.test(safeBase);
          const fileName = hasPngExt ? safeBase : `${safeBase}.png`;
          const uniqueName = `${Date.now()}-${att.id ?? "na"}-${fileName}`;
          const outPath = path.join(storageDir, uniqueName);
          await fs.writeFile(outPath, bytes);
          console.log("wrote PNG for debugging:", outPath);
        } catch (writeErr) {
          console.warn(
            "failed to write PNG to storage for debugging",
            writeErr
          );
        }
      }

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

// Render a list of downloaded attachments into a single PDF and return its bytes
export async function renderAttachmentsToPdf(
  attachments: DownloadedAttachment[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const file of attachments) {
    const { name, contentType, bytes } = file;

    // Merge PDFs
    if (contentType.includes("pdf")) {
      const ext = await PDFDocument.load(bytes);
      const pages = await pdfDoc.copyPages(ext, ext.getPageIndices());
      for (const p of pages) pdfDoc.addPage(p);
      continue;
    }

    // Images (PNG/JPEG) — page sized exactly to image, no whitespace
    if (contentType.startsWith("image/")) {
      const img =
        contentType === "image/png"
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      continue;
    }

    // Text-like content — tighter margins and pagination
    if (
      contentType.startsWith("text/") ||
      contentType.includes("json") ||
      contentType.includes("csv")
    ) {
      const text = new TextDecoder().decode(bytes);
      const pageSize: [number, number] = [612, 792]; // Letter
      const margin = 24; // tighter margins
      const fontSize = 9; // smaller font to fit more content
      const lineGap = 11; // tighter line spacing
      const maxWidth = pageSize[0] - margin * 2;

      let page = pdfDoc.addPage(pageSize);
      let y = pageSize[1] - margin;
      // Small title
      page.drawText(name, {
        x: margin,
        y,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });
      y -= lineGap + 6;

      // Simple character-based wrapping as an estimate
      const approxCharWidth = fontSize * 0.6; // rough estimate
      const charsPerLine = Math.max(10, Math.floor(maxWidth / approxCharWidth));
      const wrap = (s: string, n: number) =>
        s.match(new RegExp(`.{1,${n}}`, "g")) ?? [s];
      const lines = wrap(text, charsPerLine);

      for (const line of lines) {
        if (y < margin) {
          page = pdfDoc.addPage(pageSize);
          y = pageSize[1] - margin;
        }
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        y -= lineGap;
      }
      continue;
    }

    // Unsupported type placeholder
    const page = pdfDoc.addPage([612, 792]);
    page.drawText(name, {
      x: 50,
      y: 740,
      size: 12,
      font,
      color: rgb(0.9, 0.9, 0.95),
    });
    page.drawText("(Unsupported file type for inline preview)", {
      x: 50,
      y: 720,
      size: 10,
      font,
      color: rgb(0.85, 0.85, 0.9),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
