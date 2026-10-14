import { createElement, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";
import { buildPasMapHtml } from "@/lib/map-html";
import { PAS } from "@/lib/pas";
import type { PasMapProps, PasMapRef } from "./pas-map";

export type { PasMapProps, PasMapRef };

export const PasMap = forwardRef<PasMapRef, PasMapProps>(function PasMap(
  {
    initialCenter,
    initialZoom = 11,
    pickable = false,
    pins,
    trail,
    me,
    selectedSpot,
    accessibilityLabel,
    onReady,
    onPickPin,
    onTap,
  },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(
    () => buildPasMapHtml({ initialCenter, initialZoom, pickable }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sendCmd = (cmd: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(cmd), "*");
  };

  useImperativeHandle(ref, () => ({
    panTo(spot, delta = 0.02, offsetTop = false) {
      sendCmd({ action: "panTo", spot, delta, offsetTop });
    },
    fitToCoordinates(coords, padding, animated = true) {
      sendCmd({ action: "fit", coords, padding, animated });
    },
  }));

  useEffect(() => {
    sendCmd({
      action: "state",
      state: { pins, trail, me, selectedSpot },
    });
  }, [pins, trail, me, selectedSpot]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      try {
        const msg = (typeof event.data === "string" ? JSON.parse(event.data) : event.data) as
          | { type: "ready" }
          | { type: "pick"; id: string }
          | { type: "tap"; lat: number; lng: number };
        if (msg?.type === "ready") {
          sendCmd({ action: "state", state: { pins, trail, me, selectedSpot } });
          onReady?.();
        } else if (msg?.type === "pick") {
          onPickPin?.(msg.id);
        } else if (msg?.type === "tap") {
          onTap?.({ lat: msg.lat, lng: msg.lng });
        }
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  });

  return (
    <View accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} style={{ flex: 1, backgroundColor: PAS.mapPaper }}>
      {createElement("iframe", {
        ref: iframeRef,
        srcDoc: html,
        title: accessibilityLabel ?? "Map of Hyderabad",
        style: { border: 0, width: "100%", height: "100%", backgroundColor: PAS.mapPaper },
      })}
    </View>
  );
});
