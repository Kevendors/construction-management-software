"use client";

import * as React from "react";
import { Camera, RefreshCw, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { videoFrameToDataUrl } from "@/lib/image";

/**
 * Live front-camera selfie capture. The photo is always grabbed from the
 * getUserMedia stream — there is deliberately no file input, so a gallery
 * image can never be submitted. (This blocks gallery uploads, not true
 * liveness — a photo of a photo would still pass.)
 */
export function CameraCapture({
  onCapture,
  disabled,
}: {
  onCapture: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState("");
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    async function start() {
      setReady(false);
      setError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser does not support the camera. Use a recent Chrome/Safari over HTTPS.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
          setReady(true);
        }
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access is blocked. Allow the camera for this site and retry."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Could not start the camera. Close other apps using it and retry."
        );
      }
    }

    start();
    // iOS Safari kills the stream when the tab is backgrounded — restart it.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !streamRef.current?.active) {
        setRetryKey((k) => k + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [retryKey]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const dataUrl = videoFrameToDataUrl(video, 1080, 0.75);
    if (!dataUrl) {
      setError("Could not capture the photo — retry.");
      return;
    }
    onCapture(dataUrl);
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        {/* mirror the preview like a selfie camera */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="aspect-[3/4] w-full -scale-x-100 object-cover"
        />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            Starting camera…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <VideoOff className="h-8 w-8 text-white/70" />
            <p className="text-sm text-white/90">{error}</p>
            <Button size="sm" variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
              <RefreshCw /> Retry
            </Button>
          </div>
        )}
      </div>
      <Button className="h-14 w-full text-base" onClick={capture} disabled={!ready || !!error || disabled}>
        <Camera className="!size-5" /> Capture Selfie
      </Button>
    </div>
  );
}
