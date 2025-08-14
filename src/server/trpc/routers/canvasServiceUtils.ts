import type {
  AxiosError,
  AxiosResponse,
  AxiosResponseHeaders,
  RawAxiosResponseHeaders,
} from "axios";
import { axiosClient } from "../../../utils/axiosUtils";
import dotenv from "dotenv";
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

const getNextUrl = (
  headers: AxiosResponseHeaders | RawAxiosResponseHeaders
): string | undefined => {
  const linkHeader: string | undefined =
    typeof headers.get === "function"
      ? (headers.get("link") as string)
      : ((headers as RawAxiosResponseHeaders)["link"] as string);

  if (!linkHeader) {
    console.log("could not find link header in the response");
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

  const returnData = [];
  let nextUrl: string | undefined = url.toString();

  while (nextUrl) {
    const { data, headers } = await rateLimitGet<T>(
      nextUrl,
      canvasRequestOptions
    );

    if (data) {
      returnData.push(...data);
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
