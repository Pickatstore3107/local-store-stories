import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { inHyderabad } from "@/lib/nearby";
import type { LatLng } from "@/lib/pins";

// Where you are, for the red dot and the posts near you, as the website's
// src/components/map/use-my-location.ts. The phone only asks once someone
// taps Near me, and the spot stays in the app: it's never saved or sent to us.

export type MyLocation =
  | { status: "off" }
  | { status: "finding" }
  | { status: "on"; spot: LatLng; accuracy: number }
  | { status: "outside" }
  | { status: "denied" }
  | { status: "unavailable" };

export function useMyLocation() {
  const [wanted, setWanted] = useState(false);
  const [location, setLocation] = useState<MyLocation>({ status: "off" });

  // Follows you while the map is open; stops when you leave it.
  useEffect(() => {
    if (!wanted) return;
    let stopped = false;
    let watch: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (stopped) return;
        if (!granted) {
          setWanted(false);
          setLocation({ status: "denied" });
          return;
        }
        watch = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 20 },
          ({ coords }) => {
            const spot = { lat: coords.latitude, lng: coords.longitude };
            setLocation(inHyderabad(spot) ? { status: "on", spot, accuracy: coords.accuracy ?? 0 } : { status: "outside" });
          },
        );
        if (stopped) watch.remove();
      } catch {
        if (stopped) return;
        setWanted(false);
        setLocation({ status: "unavailable" });
      }
    })();
    return () => {
      stopped = true;
      watch?.remove();
    };
  }, [wanted]);

  function locate() {
    if (location.status !== "on") setLocation({ status: "finding" });
    setWanted(true);
  }

  return { location, locate };
}
