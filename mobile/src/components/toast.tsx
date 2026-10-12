import { useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { PAS, font } from "@/lib/pas";

// The prototype's toast, as the website's src/components/pas/toast.tsx: a
// dark note near the bottom for 2.2 seconds, with a yellow tick. flash()
// shows one from anywhere in the app.

let text: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function flash(t: string) {
  text = t;
  listeners.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(() => {
    text = null;
    listeners.forEach((l) => l());
  }, 2200);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function Toast() {
  const insets = useSafeAreaInsets();
  const toast = useSyncExternalStore(subscribe, () => text);
  if (!toast) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 18,
        right: 18,
        bottom: insets.bottom + 100,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: PAS.ink,
        shadowColor: PAS.ink,
        shadowOpacity: 0.3,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 12 },
        elevation: 8,
      }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: PAS.yellow, alignItems: "center", justifyContent: "center" }}>
        <Svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={PAS.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <Path d="m5 12.5 4.5 4.5L19 7.5" />
        </Svg>
      </View>
      <Text style={[font("600 13.5px", "Plus Jakarta Sans"), { color: "#fff", flex: 1 }]}>{toast}</Text>
    </View>
  );
}
