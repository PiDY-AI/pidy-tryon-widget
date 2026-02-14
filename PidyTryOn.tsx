// PidyTryOn.tsx — PIDY Virtual Try-On Headless Component
// Drop this file into any React project. Zero external dependencies.
//
// Usage:
//   import { PidyTryOn } from "./PidyTryOn";
//   <PidyTryOn productId="OVO-STAN-VRS-2025-001" size={selectedSize} />
//
// Flow:
//   1. Shows a "Digital Fitting Room" button
//   2. User clicks → if not signed in, auth popup opens automatically
//   3. After auth (or if already signed in), try-on starts immediately
//   4. Result image appears inline, replacing the button
//   5. User can retry, generate with new size, close, or sign out

import { useEffect, useState, useRef } from "react";

const PIDY_SDK_URL = "https://pidy-tryon.vercel.app/sdk.js";

declare global {
  interface Window {
    PidyTryOn?: {
      init: (config: {
        container: string;
        productId: string;
        size?: string;
        authMethod?: "modal" | "popup" | "redirect";
        width?: number;
        height?: number;
      }) => void;
    };
  }
}

interface PidyTryOnProps {
  productId: string;
  size?: string;
}

export function PidyTryOn({ productId, size }: PidyTryOnProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [tryOnImage, setTryOnImage] = useState<string | null>(null);
  const [tryOnSize, setTryOnSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const lastSizeRef = useRef<string | null>(null);

  // Load SDK + init hidden widget
  useEffect(() => {
    if (!productId || initializedRef.current) return;

    const existingScript = document.querySelector('script[src*="sdk.js"]');

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = PIDY_SDK_URL;
      script.async = true;
      script.onload = () => initWidget();
      document.head.appendChild(script);
    } else {
      initWidget();
    }

    function initWidget() {
      setTimeout(() => {
        if (window.PidyTryOn && widgetRef.current) {
          window.PidyTryOn.init({
            container: `#pidy-widget-${productId}`,
            productId,
            size: size || undefined,
            authMethod: "popup",
            width: 380,
            height: 580,
          });

          // Re-hide after SDK overrides container styles
          if (widgetRef.current) {
            widgetRef.current.style.cssText =
              "position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;clip:rect(0,0,0,0);clip-path:inset(50%)";
          }

          initializedRef.current = true;
        }
      }, 100);
    }
  }, [productId]);

  // Listen for SDK messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const { type, source } = event.data || {};
      if (source !== "pidy-widget") return;

      switch (type) {
        case "pidy-tryon-started":
          setIsProcessing(true);
          setError(null);
          break;

        case "pidy-tryon-result": {
          const { images, recommendedSize } = event.data;
          if (images && images.length > 0) {
            setTryOnImage(images[0]);
            const resultSize = recommendedSize || size || "M";
            setTryOnSize(resultSize);
            lastSizeRef.current = resultSize;
            setIsProcessing(false);
            setIsAuthenticated(true);
          }
          break;
        }

        case "pidy-tryon-error":
          setError(event.data.error || "Try-on failed");
          setIsProcessing(false);
          break;

        case "pidy-auth-required":
          setIsProcessing(true);
          break;

        case "pidy-auth-success":
          setIsAuthenticated(true);
          break;

        case "pidy-auth-cancelled":
          setIsProcessing(false);
          break;

        case "pidy-sign-out":
          setIsAuthenticated(false);
          setTryOnImage(null);
          setTryOnSize(null);
          setIsProcessing(false);
          setError(null);
          lastSizeRef.current = null;
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [size]);

  const isSizeSelected = !!size && size.trim() !== "";

  const handleTryOn = () => {
    if (!isSizeSelected) return;

    const isRetry = lastSizeRef.current === size;
    setIsProcessing(true);
    setError(null);

    const iframe = widgetRef.current?.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: "pidy-start-tryon", productId, size, retry: isRetry },
        "*"
      );
    } else {
      setError("Widget not ready. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setTryOnImage(null);
    setTryOnSize(null);
    setIsProcessing(false);
    setError(null);
  };

  const handleSignOut = () => {
    const iframe = widgetRef.current?.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: "pidy-sign-out-request" },
        "*"
      );
    }
    setIsAuthenticated(false);
    setTryOnImage(null);
    setTryOnSize(null);
    setIsProcessing(false);
    setError(null);
    lastSizeRef.current = null;
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Hidden SDK iframe */}
      <div
        id={`pidy-widget-${productId}`}
        ref={widgetRef}
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
          clip: "rect(0,0,0,0)",
          clipPath: "inset(50%)",
        }}
      />

      {/* Button */}
      {!tryOnImage && (
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={isSizeSelected && !isProcessing ? handleTryOn : undefined}
            disabled={isProcessing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 20px",
              borderRadius: "999px",
              border: "none",
              fontSize: "14px",
              fontWeight: 500,
              cursor: isProcessing ? "not-allowed" : "pointer",
              background: isProcessing ? "rgba(201,168,98,0.5)" : "#c9a862",
              color: "white",
              boxShadow: "0 4px 12px rgba(201,168,98,0.3)",
            }}
          >
            {isProcessing ? (
              <>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "pidy-spin 0.8s linear infinite",
                    display: "inline-block",
                  }}
                />
                Your look is being prepared...
              </>
            ) : (
              <>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    background: "white",
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#c9a862",
                  }}
                >
                  P
                </span>
                Digital Fitting Room
              </>
            )}
          </button>

          {!isSizeSelected && !isProcessing && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#e53e3e" }}>
              Select a size first
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && !tryOnImage && (
        <p style={{ fontSize: 13, color: "#e53e3e", marginTop: 8 }}>
          {error}
        </p>
      )}

      {/* Result */}
      {tryOnImage && (
        <div
          style={{
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #e5e5e5",
            background: "white",
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            marginTop: 8,
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 10,
            }}
          >
            x
          </button>

          <img
            src={tryOnImage}
            alt="Virtual Try-On"
            style={{
              width: "100%",
              aspectRatio: "3/4",
              objectFit: "contain",
              background: "#f5f5f5",
            }}
          />

          <div style={{ padding: 16, borderTop: "1px solid #eee" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    color: "#888",
                    margin: 0,
                  }}
                >
                  Tried Size
                </p>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                  {tryOnSize}
                </p>
              </div>
              <button
                onClick={() => {
                  setTryOnImage(null);
                  setTryOnSize(null);
                  handleTryOn();
                }}
                disabled={isProcessing}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  border:
                    size !== tryOnSize
                      ? "1px solid #c9a862"
                      : "1px solid #ddd",
                  background: size !== tryOnSize ? "#c9a862" : "white",
                  color: size !== tryOnSize ? "white" : "inherit",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {isProcessing
                  ? "Generating..."
                  : size !== tryOnSize
                  ? "Generate"
                  : "Retry"}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 12,
                marginTop: 12,
                borderTop: "1px solid #f0f0f0",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: "#999",
              }}
            >
              <span>Powered by PIDY</span>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    fontSize: 10,
                    color: "#999",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pidy-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
