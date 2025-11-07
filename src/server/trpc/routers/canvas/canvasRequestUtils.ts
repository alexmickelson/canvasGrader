import type {
  AxiosResponse,
  AxiosRequestConfig,
  AxiosError,
  RawAxiosResponseHeaders,
} from "axios";
import { axiosClient } from "../../../../utils/axiosUtils";

const rateLimitRetryCount = 6;
const rateLimitSleepInterval = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isRateLimited = async (
  response: AxiosResponse
): Promise<boolean> => {
  if (response.status === 429) {
    return true;
  }
  const content = await response.data;
  return (
    response.status === 403 &&
    content.includes("403 Forbidden (Rate Limit Exceeded)")
  );
};

export const rateLimitAwarePost = async <T>(
  url: string,
  body: unknown,
  config?: AxiosRequestConfig,
  retryCount = 0
): Promise<AxiosResponse<T>> => {
  const response = await axiosClient.post<T>(url, body, config);

  if (await isRateLimited(response)) {
    if (retryCount < rateLimitRetryCount) {
      console.info(
        `Hit rate limit on post, retry count is ${retryCount} / ${rateLimitRetryCount}, retrying`
      );
      await sleep(rateLimitSleepInterval);
      return await rateLimitAwarePost<T>(url, body, config, retryCount + 1);
    }
  }

  return response;
};

export const rateLimitAwareGet = async <T>(
  url: string,
  options: object,
  maxRetries: number = rateLimitRetryCount,
  sleepInterval: number = rateLimitSleepInterval,
  retryCount: number = 0
): Promise<{ data: T; headers: RawAxiosResponseHeaders }> => {
  try {
    const response = await axiosClient.get<T>(url, options);
    return { data: response.data, headers: response.headers };
  } catch (error) {
    const axiosError = error as AxiosError & {
      response?: { status: number; headers: RawAxiosResponseHeaders };
    };

    if (axiosError.response && (await isRateLimited(axiosError.response))) {
      if (retryCount < maxRetries) {
        console.info(
          `Hit rate limit, retry count is ${retryCount} / ${maxRetries}, retrying`
        );
        await sleep(sleepInterval);
        return rateLimitAwareGet<T>(
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
};

export const rateLimitAwareDelete = async (
  url: string,
  retryCount = 0
): Promise<void> => {
  try {
    const response = await axiosClient.delete(url);

    if (await isRateLimited(response)) {
      console.info("After delete response in rate limited");
      await sleep(rateLimitSleepInterval);
      return await rateLimitAwareDelete(url, retryCount + 1);
    }
  } catch (e) {
    const error = e as Error & { response?: Response };
    if (error.response?.status === 403) {
      if (retryCount < rateLimitRetryCount) {
        console.info(
          `Hit rate limit in delete, retry count is ${retryCount} / ${rateLimitRetryCount}, retrying`
        );
        await sleep(rateLimitSleepInterval);
        return await rateLimitAwareDelete(url, retryCount + 1);
      } else {
        console.info(
          `Hit rate limit in delete, ${rateLimitRetryCount} retries did not fix it`
        );
      }
    }
    throw e;
  }
};
