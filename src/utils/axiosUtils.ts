import axios, { type AxiosInstance, AxiosError } from "axios";
import toast from "react-hot-toast";

export const axiosClient: AxiosInstance = axios.create();

axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const errorMessage = getAxiosErrorMessage(error);
    console.error(errorMessage);
    if (errorMessage) toast.error(errorMessage);
    return Promise.reject(error);
  }
);
export function getAxiosErrorMessage(error: AxiosError) {
  const url = error.config?.url || error.response?.config?.url || "unknown URL";
  console.log("response error", error.response?.statusText, "URL:", url);
  let responseErrorText: string | undefined;

  if (typeof error.response?.data === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseErrorText = (error.response?.data as any)?.error;
  } else if (
    typeof error.response?.data === "string" &&
    error.response?.data.trim().startsWith("<!DOCTYPE html")
  ) {
    responseErrorText = "";
  } else {
    responseErrorText = error.response?.data as string | undefined;
  }

  return `Error: ${error.response?.status} - ${responseErrorText}, ${decodeURI(
    url
  )}`;
}
