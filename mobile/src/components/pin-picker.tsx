import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { areaCenter, HYDERABAD, pinAt, pinCenter, type Pin } from "@/lib/pins";
import { PAS, font } from "@/lib/pas";
import { PasMap, type PasMapRef } from "./pas-map";

/**
 * A map of Hyderabad to tap where the store was, as the website's
 * pin-picker.tsx. The pin goes in the middle of the 500-metre square
 * around the tap, never on the exact spot.
 */
export function PinPicker({ value, onChange, neighbourhood = "" }: { value: Pin | null; onChange: (pin: Pin | null) => void; neighbourhood?: string }) {
  const map = useRef<PasMapRef>(null);
  const [outside, setOutside] = useState(false);
  const first = useRef(value);
  const start = first.current ? pinCenter(first.current) : HYDERABAD.center;
  const center = value ? pinCenter(value) : null;
  const area = areaCenter(neighbourhood);

  // A pin picked from the search moves the map to it.
  useEffect(() => {
    if (!value) return;
    const c = pinCenter(value);
    map.current?.panTo(c, 0.02);
  }, [value]);

  const link = [font("700 13px", "Plus Jakarta Sans"), { color: PAS.red, textDecorationLine: "underline" as const }];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 300, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: PAS.border }}>
        <PasMap
          ref={map}
          initialCenter={start}
          initialZoom={first.current ? 14 : 11}
          pickable
          selectedSpot={center}
          accessibilityLabel="Map of Hyderabad. Tap where the store was."
          onTap={(spot) => {
            const pin = pinAt(spot);
            setOutside(!pin);
            if (pin) onChange(pin);
          }}
        />
        {!value && (
          <View pointerEvents="none" style={{ position: "absolute", top: 12, alignSelf: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: PAS.ink }}>
            <Text style={[font("700 12px", "Plus Jakarta Sans"), { color: "#fff" }]}>Tap where the store was</Text>
          </View>
        )}
      </View>
      <Text accessibilityLiveRegion="polite" style={[font("500 13px", "Plus Jakarta Sans"), { color: PAS.ink }]}>
        {outside
          ? "Pins can only go in Hyderabad for now."
          : value
            ? "Pinned. It shows within about 500 m of this spot. Tap again to move it."
            : "No pin yet."}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        {area && (
          <Pressable accessibilityRole="button" onPress={() => map.current?.panTo(area, 0.02)}>
            <Text style={link}>Go to {neighbourhood.trim()}</Text>
          </Pressable>
        )}
        {value && (
          <Pressable accessibilityRole="button" onPress={() => { setOutside(false); onChange(null); }}>
            <Text style={link}>Remove pin</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
