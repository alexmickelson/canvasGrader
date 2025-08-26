import type { FC } from "react";
import DOMPurify from "dompurify";
import type { CanvasSubmission } from "../../server/trpc/routers/canvas/canvasRouter";
import { usePreviewPdfQuery } from "./graderHooks";
import Spinner from "../../utils/Spinner";
import { PDFPreview } from "../../utils/PDFPreview";

export const AssignmentPreviewComponent: FC<{
  submission: CanvasSubmission;
  courseId: number;
}> = ({ submission, courseId }) => {
  const body = submission.body?.trim();
  const previewUrl = submission.preview_url || null;
  const htmlUrl = submission.html_url || null;
  const submittedUrl = submission.url || null;

  // Top-level hook usage; it's safe even if we early-return for other cases.
  const previewPdfQuery = usePreviewPdfQuery({
    courseId,
    assignmentId: submission.assignment_id,
    userId: submission.user_id,
  });
  const { data, isLoading, isError, error } = previewPdfQuery;
  const pdfDataUrl = data?.pdfBase64
    ? `data:application/pdf;base64,${data.pdfBase64}`
    : null;

  // Only show PDF preview for submissions with file attachments, not text entries
  const isTextOnlySubmission =
    body && submission.submission_type === "online_text_entry";
  const shouldShowPdfPreview = previewUrl && !isTextOnlySubmission;

  if (body && isTextOnlySubmission) {
    return (
      <section className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          Text entry
        </div>
        <div
          className="rounded border border-gray-700 bg-gray-900 p-3 text-sm text-gray-100 [&_a]:text-indigo-300 [&_a:hover]:text-indigo-200 [&_p]:mb-2 [&_code]:bg-gray-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body) }}
        />
      </section>
    );
  }

  if (shouldShowPdfPreview) {
    return (
      <section className="space-y-2 h-full flex flex-col">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          Preview PDF
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Spinner
              size={16}
              className="text-gray-400"
              aria-label="Loading preview PDF"
            />
            Generating PDF from preview…
          </div>
        )}

        {!isLoading && isError && (
          <div className="rounded border border-gray-700 bg-gray-900 p-3 text-sm text-red-300">
            Failed to build preview PDF
            {error instanceof Error ? ": " + error.message : "."}
          </div>
        )}

        {!isLoading && !isError && !pdfDataUrl && data === null && (
          <div className="rounded border border-gray-700 bg-gray-900 p-3 text-sm text-yellow-300">
            No attachments found for this submission - unable to generate PDF
            preview.
          </div>
        )}

        {!isLoading && !isError && pdfDataUrl && (
          <div className="flex-1 min-h-0">
            <PDFPreview pdfDataUrl={pdfDataUrl} className="w-full h-full" />
          </div>
        )}

        <div className="text-[11px] text-gray-500 flex-shrink-0">
          If the PDF fails to load, open the original preview below.
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 hover:bg-gray-700"
          >
            Open Original Preview
          </a>
          {pdfDataUrl && (
            <a
              href={pdfDataUrl}
              download="submission-preview.pdf"
              className="inline-flex items-center rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 hover:bg-gray-700"
            >
              Download PDF
            </a>
          )}
          {htmlUrl && (
            <a
              href={htmlUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 hover:bg-gray-700"
            >
              Open in Canvas
            </a>
          )}
        </div>
      </section>
    );
  }

  if (submittedUrl) {
    return (
      <section className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          Submitted URL
        </div>
        <a
          href={submittedUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-indigo-300 hover:text-indigo-200 underline text-sm"
        >
          Open submitted URL
        </a>
        {htmlUrl && (
          <div>
            <a
              href={htmlUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 hover:bg-gray-700"
            >
              Open in Canvas
            </a>
          </div>
        )}
      </section>
    );
  }

  if (htmlUrl) {
    return (
      <section className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          Canvas
        </div>
        <a
          href={htmlUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 hover:bg-gray-700"
        >
          Open in Canvas
        </a>
      </section>
    );
  }

  return (
    <section className="text-sm text-gray-400 border border-dashed border-gray-700 rounded p-3">
      No preview available.
    </section>
  );
};
