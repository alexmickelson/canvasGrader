import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from "axios";
import dotenv from "dotenv";
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

