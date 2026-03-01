// PidyTryOn.tsx — PIDY Virtual Try-On Widget Component
// Drop this file into any React project. Zero external dependencies.
//
// Flow:
//   1. Shows a "Digital Fitting Room" pill button (greyed out without size)
//   2. Click (not authed) → modal overlay opens with auth/onboarding inside iframe
//   3. Auth + onboarding complete → modal closes automatically, button stays
//   4. Click (authed + size) → shimmer effect with cycling messages
//   5. Result ready → expands to show 2:3 VTON image
//   6. Close → collapses back to button

import { useEffect, useState, useRef } from "react";

const PIDY_SDK_URL = "https://pidy-internal.vercel.app/sdk.js";

const SHIMMER_MESSAGES = [
  "Styling you...",
  "Almost ready...",
  "Fitting it...",
  "Looking good...",
  "Just a sec...",
  "Draping now...",
];

declare global {
  interface Window {
    PidyTryOn?: {
      init: (config: {
        container: string;
        productId: string;
        size?: string;
        apiKey?: string;
        authMethod?: "modal" | "popup" | "redirect";
        hidden?: boolean;
        width?: number;
        height?: number;
      }) => void;
    };
  }
}

export interface PidyTryOnProps {
  productId: string;
  size?: string;
  apiKey?: string;
}

export function PidyTryOn({ productId, size, apiKey }: PidyTryOnProps) {
  const [showModal, setShowModal] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tryOnImage, setTryOnImage] = useState<string | null>(null);
  const [tryOnSize, setTryOnSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shimmerIdx, setShimmerIdx] = useState(0);

  const widgetRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const initializedRef = useRef(false);
  const lastSizeRef = useRef<string | null>(null);
  const shimmerTimerRef = useRef<number | null>(null);

  // Load SDK + create hidden iframe
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
            apiKey: apiKey || undefined,
            hidden: true,
            width: 420,
            height: 740,
          });
          initializedRef.current = true;

          // Move iframe to modal container where it lives permanently
          setTimeout(() => {
            const iframe = widgetRef.current?.querySelector("iframe");
            if (iframe && modalContentRef.current) {
              iframe.style.cssText =
                "width:100%;height:100%;border:none;border-radius:16px;";
              modalContentRef.current.appendChild(iframe);
              iframeRef.current = iframe as HTMLIFrameElement;
            }
          }, 50);
        }
      }, 100);
    }
  }, [productId]);

  // Shimmer message cycling
  useEffect(() => {
    if (isProcessing) {
      shimmerTimerRef.current = window.setInterval(() => {
        setShimmerIdx((prev) => (prev + 1) % SHIMMER_MESSAGES.length);
      }, 2500);
    } else {
      if (shimmerTimerRef.current) {
        clearInterval(shimmerTimerRef.current);
        shimmerTimerRef.current = null;
      }
      setShimmerIdx(0);
    }
    return () => {
      if (shimmerTimerRef.current) clearInterval(shimmerTimerRef.current);
    };
  }, [isProcessing]);

  // Listen for widget messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const { type, source } = event.data || {};
      if (source !== "pidy-widget") return;

      switch (type) {
        case "pidy-ready":
          setAuthComplete(true);
          setShowModal(false);
          setIsProcessing(false);
          break;

        case "pidy-tryon-started":
          setIsProcessing(true);
          setError(null);
          break;

        case "pidy-tryon-result": {
          const { images, recommendedSize } = event.data;
          if (images?.length > 0) {
            setTryOnImage(images[0]);
            const resultSize = recommendedSize || size || "M";
            setTryOnSize(resultSize);
            lastSizeRef.current = resultSize;
            setIsProcessing(false);
            setAuthComplete(true);
          }
          break;
        }

        case "pidy-tryon-error":
          setError(event.data.error || "Try-on failed");
          setIsProcessing(false);
          break;

        case "pidy-auth-required":
          setAuthComplete(false);
          setShowModal(true);
          setIsProcessing(false);
          break;

        case "pidy-auth-success":
          setAuthComplete(true);
          break;

        case "pidy-auth-cancelled":
          setShowModal(false);
          setIsProcessing(false);
          break;

        case "pidy-sign-out":
          setAuthComplete(false);
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

  // Close modal on ESC
  useEffect(() => {
    if (!showModal) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowModal(false);
        setIsProcessing(false);
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [showModal]);

  const isSizeSelected = !!size?.trim();

  const sendToIframe = (message: object) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, "*");
      return true;
    }
    return false;
  };

  const handleButtonClick = () => {
    if (isProcessing || !isSizeSelected) return;

    if (!authComplete) {
      setShowModal(true);
      return;
    }

    const isRetry = lastSizeRef.current === size;
    setIsProcessing(true);
    setError(null);

    if (
      !sendToIframe({
        type: "pidy-start-tryon",
        productId,
        size,
        apiKey,
        retry: isRetry,
      })
    ) {
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

  const handleRetry = () => {
    setTryOnImage(null);
    setTryOnSize(null);
    handleButtonClick();
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Hidden SDK init target */}
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
            onClick={handleButtonClick}
            disabled={!isSizeSelected}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 999,
              border: "none",
              fontSize: 14,
              fontWeight: 500,
              cursor: !isSizeSelected ? "default" : "pointer",
              color: "white",
              overflow: "hidden",
              transition: "all 0.3s ease",
              ...(isProcessing
                ? {
                    background:
                      "linear-gradient(135deg, #b8860b 0%, #c9a862 50%, #daa520 100%)",
                    backgroundSize: "200% 200%",
                    animation: "pidy-shimmer-bg 3s ease infinite",
                  }
                : !isSizeSelected
                ? { background: "#999", opacity: 0.6 }
                : {
                    background: "#c9a862",
                    boxShadow: "0 4px 12px rgba(201,168,98,0.3)",
                  }),
            }}
          >
            {isProcessing && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
                  animation: "pidy-shimmer-sweep 1.5s ease-in-out infinite",
                  borderRadius: 999,
                }}
              />
            )}
            <span
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
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
                  color: isProcessing
                    ? "#b8860b"
                    : !isSizeSelected
                    ? "#999"
                    : "#c9a862",
                  flexShrink: 0,
                }}
              >
                P
              </span>
              {isProcessing
                ? SHIMMER_MESSAGES[shimmerIdx]
                : "Digital Fitting Room"}
            </span>
          </button>

          {!isSizeSelected && !isProcessing && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#999" }}>
              Select a size to try on
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && !tryOnImage && (
        <p style={{ fontSize: 13, color: "#e53e3e", marginTop: 8 }}>{error}</p>
      )}

      {/* Result card */}
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
            animation: "pidy-expand-in 0.3s ease-out",
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
              aspectRatio: "2/3",
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
                type="button"
                onClick={handleRetry}
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
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay — always in DOM, display toggled to preserve iframe state */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowModal(false);
            setIsProcessing(false);
          }
        }}
        style={{
          display: showModal ? "flex" : "none",
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 999999,
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 420,
            height: 740,
            maxHeight: "90vh",
            background: "#0d0d0d",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setShowModal(false);
              setIsProcessing(false);
            }}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#ffffff",
              fontSize: 18,
              cursor: "pointer",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            x
          </button>

          {/* Iframe container — iframe lives here permanently */}
          <div
            ref={modalContentRef}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>

      <style>{`
        @keyframes pidy-shimmer-bg {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pidy-shimmer-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pidy-expand-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
