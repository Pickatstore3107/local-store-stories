import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { areaCenter, HYDERABAD, pinAt, pinCenter, type Pin } from "@/lib/pins";
import { PAS, font } from "@/lib/pas";

// Half of a pin's square each way, as src/lib/pins.ts makes them.
const HALF_LAT = 0.00225, HALF_LNG = 0.00235;

/**
 * A map of Hyderabad to tap where the store was, as the website's
 * pin-picker.tsx. The pin goes in the middle of the 500-metre square
 * around the tap, never on the exact spot.
 */
export function PinPicker({ value, onChange, neighbourhood = "" }: { value: Pin | null; onChange: (pin: Pin | null) => void; neighbourhood?: string }) {
  const map = useRef<MapView>(null);
  const [outside, setOutside] = useState(false);
  const first = useRef(value);
  const start = first.current ? pinCenter(first.current) : HYDERABAD.center;
  const center = value ? pinCenter(value) : null;
  const area = areaCenter(neighbourhood);

  // A pin picked from the search moves the map to it.
  useEffect(() => {
    if (!value) return;
    const c = pinCenter(value);
    map.current?.animateToRegion({ latitude: c.lat, longitude: c.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
  }, [value]);

  const link = [font("700 13px", "Plus Jakarta Sans"), { color: PAS.red, textDecorationLine: "underline" as const }];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 300, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: PAS.border }}>
        <MapView
          ref={map}
          style={{ flex: 1 }}
          initialRegion={{ latitude: start.lat, longitude: start.lng, latitudeDelta: first.current ? 0.02 : 0.25, longitudeDelta: first.current ? 0.02 : 0.25 }}
          toolbarEnabled={false}
          accessibilityLabel="Map of Hyderabad. Tap where the store was."
          onPress={(e) => {
            const pin = pinAt({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });
            setOutside(!pin);
            if (pin) onChange(pin);
          }}
        >
          {center && (
            <>
              <Polygon
                coordinates={[
                  { latitude: center.lat - HALF_LAT, longitude: center.lng - HALF_LNG },
                  { latitude: center.lat - HALF_LAT, longitude: center.lng + HALF_LNG },
                  { latitude: center.lat + HALF_LAT, longitude: center.lng + HALF_LNG },
                  { latitude: center.lat + HALF_LAT, longitude: center.lng - HALF_LNG },
                ]}
                strokeColor={PAS.red}
                strokeWidth={2}
                fillColor="rgba(163,23,27,0.15)"
              />
              <Marker coordinate={{ latitude: center.lat, longitude: center.lng }} pinColor={PAS.red} tracksViewChanges={false} />
            </>
          )}
        </MapView>
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
          <Pressable accessibilityRole="button" onPress={() => map.current?.animateToRegion({ latitude: area.lat, longitude: area.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500)}>
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
