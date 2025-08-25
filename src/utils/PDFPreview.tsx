import React, { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker - use a more reliable approach
// This ensures version compatibility by using the worker bundled with the current pdfjs-dist version
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFPreviewProps {
  pdfDataUrl: string;
  className?: string;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({
  pdfDataUrl,
  className = "",
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pdfData, setPdfData] = useState<string | { data: Uint8Array } | null>(
    null
  );
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Convert data URL to format that react-pdf can handle
  useEffect(() => {
    if (pdfDataUrl) {
      try {
        console.log("Processing PDF data URL, length:", pdfDataUrl.length);

        // Extract base64 data from data URL
        const base64Data = pdfDataUrl.replace(
          /^data:application\/pdf;base64,/,
          ""
        );
        console.log("Base64 data length:", base64Data.length);

        // Try multiple approaches to find what works best

        // Approach 1: Convert to Uint8Array (recommended by react-pdf docs)
        try {
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          console.log("Converted to Uint8Array, length:", bytes.length);
          setPdfData({ data: bytes });
          return;
        } catch (uintError) {
          console.warn("Uint8Array approach failed:", uintError);
        }

        // Approach 2: Try using the original data URL directly
        console.log("Falling back to original data URL");
        setPdfData(pdfDataUrl);
      } catch (error) {
        console.error("Error processing PDF data:", error);
        setPdfData(null);
      }
    }
  }, [pdfDataUrl]);

  // Cleanup blob URLs when component unmounts or pdfData changes
  useEffect(() => {
    return () => {
      if (
        pdfData &&
        typeof pdfData === "string" &&
        pdfData.startsWith("blob:")
      ) {
        URL.revokeObjectURL(pdfData);
      }
    };
  }, [pdfData]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    console.log("PDF loaded successfully with", numPages, "pages");
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF loading error:", error);
    console.error("PDF data type:", typeof pdfData);
    console.error("PDF data URL length:", pdfDataUrl?.length);
    console.error(
      "PDF data info:",
      typeof pdfData === "string"
        ? `string length: ${pdfData.length}`
        : "Uint8Array object"
    );
    setIsLoading(false);
  };

  // Handle wheel zoom - only when focused
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isFocused) return;

      const zoomFactor = 0.1;
      const newScale =
        e.deltaY > 0
          ? Math.max(0.5, scale - zoomFactor)
          : Math.min(3.0, scale + zoomFactor);

      setScale(newScale);

      // Reset position when zooming to prevent getting lost
      if (newScale === 1.0) {
        setPosition({ x: 0, y: 0 });
      }
    },
    [scale, isFocused]
  );

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, dragStart]);

  // Add wheel event listener when focused
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isFocused) return;

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel, isFocused]);

  // Handle mouse drag - allow at all zoom levels
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      e.preventDefault();
    },
    [position]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Mouse move is now handled by global listeners when dragging
    e.preventDefault();
  }, []);

  const handleMouseUp = useCallback(() => {
    // Mouse up is now handled by global listeners
  }, []);

  // Focus handlers
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setIsDragging(false); // Stop dragging when losing focus
  }, []);

  // Handle click to focus
  const handleClick = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // Handle keyboard navigation - only when focused
  useEffect(() => {
    if (!isFocused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && pageNumber > 1) {
        e.preventDefault();
        setPageNumber(pageNumber - 1);
      } else if (e.key === "ArrowRight" && pageNumber < numPages) {
        e.preventDefault();
        setPageNumber(pageNumber + 1);
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setScale((prev) => Math.min(3.0, prev + 0.1));
      } else if (e.key === "-") {
        e.preventDefault();
        setScale((prev) => Math.max(0.5, prev - 0.1));
      } else if (e.key === "0") {
        e.preventDefault();
        setScale(1.0);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pageNumber, numPages, isFocused]);

  const zoomIn = () => setScale((prev) => Math.min(3.0, prev + 0.2));
  const zoomOut = () => setScale((prev) => Math.max(0.5, prev - 0.2));
  const resetZoom = () => {
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div
      className={`relative bg-gray-900 border border-gray-700 rounded overflow-hidden h-full flex flex-col ${className}`}
    >
      {/* Controls */}
      <div className="absolute top-2 left-2 right-2 z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-black bg-opacity-40 rounded p-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 order-2 sm:order-1">
          <button
            onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
            disabled={pageNumber <= 1}
            className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            title="Previous page (←)"
          >
            ←
          </button>
          <span className="text-white text-sm font-medium min-w-16 text-center">
            {numPages > 0 ? `${pageNumber} / ${numPages}` : "0 / 0"}
          </span>
          <button
            onClick={() =>
              setPageNumber((prev) => Math.min(numPages, prev + 1))
            }
            disabled={pageNumber >= numPages}
            className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            title="Next page (→)"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-2 order-1 sm:order-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            title="Zoom out (-)"
          >
            −
          </button>
          <span className="text-white text-sm font-medium min-w-16 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            title="Zoom in (+)"
          >
            +
          </button>
          <button
            onClick={resetZoom}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
            title="Reset zoom (0)"
          >
            Reset
          </button>
        </div>
      </div>

      {/* PDF Container */}
      <div
        ref={containerRef}
        className={`w-full flex-1 min-h-0 overflow-hidden transition-all duration-200 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        tabIndex={0}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          // Ensure the border is always visible by using box-shadow when focused
          ...(isFocused && {
            boxShadow: "inset 0 0 0 2px rgb(99 102 241)", // indigo-500
          }),
        }}
      >
        <div
          ref={pdfRef}
          className="flex justify-center items-center min-h-full transition-transform duration-75"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-white bg-gray-800 rounded">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
              <h3 className="text-lg font-medium mb-2">Loading PDF...</h3>
              <p className="text-sm text-gray-400">
                This may take a moment for larger files
              </p>
            </div>
          )}

          {!isLoading && !pdfData && (
            <div className="text-yellow-300 p-8 text-center bg-gray-800 rounded">
              <h3 className="text-lg font-medium mb-2">Processing PDF...</h3>
              <p className="text-sm text-gray-400">
                Converting PDF data for display
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Original data length: {pdfDataUrl?.length || "unknown"}
              </p>
            </div>
          )}

          {pdfData && (
            <Document
              file={pdfData}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading=""
              error={
                <div className="text-red-300 p-8 text-center bg-gray-800 rounded">
                  <svg
                    className="mx-auto h-12 w-12 text-red-300 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium mb-2">
                    Failed to load PDF
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    This PDF format might not be supported by the browser
                    viewer.
                  </p>
                  <p className="text-xs text-gray-500">
                    Try downloading the PDF directly using the button below.
                  </p>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                className="shadow-lg"
              />
            </Document>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-2 left-2 right-2">
        <div className="bg-black bg-opacity-40 rounded px-3 py-2 backdrop-blur-sm">
          <div className="text-center">
            {!isFocused ? (
              <p className="text-white text-xs leading-relaxed">
                👆 Click to focus for controls
              </p>
            ) : (
              <>
                <p className="text-white text-xs leading-relaxed">
                  <span className="inline-block mr-3">🖱️ Scroll to zoom</span>
                  <span className="inline-block mr-3">
                    👆 Click & drag to pan
                  </span>
                  <span className="inline-block mr-3">
                    ⌨️ Arrow keys for pages
                  </span>
                  <span className="inline-block">0️⃣ Press 0 to reset</span>
                </p>
                <p className="text-indigo-300 text-xs mt-1">
                  📌 PDF viewer is focused - keyboard shortcuts active
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
