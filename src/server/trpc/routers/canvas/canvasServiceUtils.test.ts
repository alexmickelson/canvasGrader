import { describe, it, expect } from "vitest";
import { getDownloadableAttachmentMatches } from "./canvasServiceUtils.js";

describe("getDownloadableAttachmentMatches", () => {
  it("should extract file links from submission body HTML", () => {
    const submissionBody = `<link rel="stylesheet" href="https://instructure-uploads-2.s3.amazonaws.com/account_20000000000010/attachments/162497727/DesignPlus%20Mobile%20%25282024%20May%2013%2529.css"><p><a id="188068861" class="instructure_file_link instructure_scribd_file inline_disabled" title="Link" href="https://snow.instructure.com/users/2342342/files/188068861?wrap=1&amp;verifier=asdfasdfasdf" target="_blank" data-canvas-previewable="true" data-api-endpoint="https://snow.instructure.com/api/v1/users/2342342/files/188068861" data-api-returntype="File">Final Project Proposal.pdf</a></p><script src="https://instructure-uploads-2.s3.amazonaws.com/account_20000000000010/attachments/182339931/Canvas%20Mobile%20Theme%20%2528August%2025%2529%20Verity.js"></script>`;

    const result = getDownloadableAttachmentMatches(submissionBody);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      href: "https://snow.instructure.com/users/2342342/files/188068861?wrap=1&amp;verifier=asdfasdfasdf",
      apiEndpoint:
        "https://snow.instructure.com/api/v1/users/2342342/files/188068861",
      fileName: "Final Project Proposal.pdf",
    });
  });

  it("should return empty array when no file links found", () => {
    const submissionBody = `<p>Just some text without file links</p>`;

    const result = getDownloadableAttachmentMatches(submissionBody);

    expect(result).toHaveLength(0);
  });

  it("should handle multiple file links", () => {
    const submissionBody = `
      <p><a id="1" class="instructure_file_link" href="https://example.com/file1" data-api-endpoint="https://example.com/api/file1">File1.pdf</a></p>
      <p><a id="2" class="instructure_file_link" href="https://example.com/file2" data-api-endpoint="https://example.com/api/file2">File2.docx</a></p>
    `;

    const result = getDownloadableAttachmentMatches(submissionBody);

    expect(result).toHaveLength(2);
    expect(result[0].fileName).toBe("File1.pdf");
    expect(result[1].fileName).toBe("File2.docx");
  });

  it("should handle empty string", () => {
    const result = getDownloadableAttachmentMatches("");
    expect(result).toHaveLength(0);
  });
});
