import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { buildPasMapHtml, type MapPinItem } from "@/lib/map-html";
import { PAS } from "@/lib/pas";
import type { LatLng } from "@/lib/pins";

export type PasMapRef = {
  panTo: (spot: LatLng, delta?: number, offsetTop?: boolean) => void;
  fitToCoordinates: (
    coords: LatLng[],
    padding?: { top: number; bottom: number; left: number; right: number },
    animated?: boolean,
  ) => void;
};

export type PasMapProps = {
  initialCenter: LatLng;
  initialZoom?: number;
  pickable?: boolean;
  pins?: MapPinItem[];
  trail?: LatLng[];
  me?: LatLng | null;
  selectedSpot?: LatLng | null;
  accessibilityLabel?: string;
  onReady?: () => void;
  onPickPin?: (id: string) => void;
  onTap?: (spot: LatLng) => void;
};

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
  const webview = useRef<WebView>(null);
  const html = useMemo(
    () => buildPasMapHtml({ initialCenter, initialZoom, pickable }),
    // The HTML is loaded once; camera & markers update through commands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sendCmd = (cmd: Record<string, unknown>) => {
    const json = JSON.stringify(cmd);
    webview.current?.injectJavaScript(`window.pasMapCmd && window.pasMapCmd(${json}); true;`);
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

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as
        | { type: "ready" }
        | { type: "pick"; id: string }
        | { type: "tap"; lat: number; lng: number };
      if (msg.type === "ready") {
        sendCmd({ action: "state", state: { pins, trail, me, selectedSpot } });
        onReady?.();
      } else if (msg.type === "pick") {
        onPickPin?.(msg.id);
      } else if (msg.type === "tap") {
        onTap?.({ lat: msg.lat, lng: msg.lng });
      }
    } catch {}
  };

  return (
    <View accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} style={{ flex: 1, backgroundColor: PAS.mapPaper }}>
      <WebView
        ref={webview}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://local-store-stories.vercel.app" }}
        style={{ flex: 1, backgroundColor: PAS.mapPaper }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={onMessage}
      />
    </View>
  );
});
