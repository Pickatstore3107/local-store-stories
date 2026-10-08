"use client";

import { useEffect, useState } from "react";
import { inHyderabad } from "@/lib/nearby";
import type { LatLng } from "@/lib/pins";

// Where you are, for the blue dot and the stores near you. The phone only
// asks once someone taps the locate button, and the spot stays in the page:
// it's never saved or sent to us.

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
    if (!("geolocation" in navigator)) {
      queueMicrotask(() => setLocation({ status: "unavailable" }));
      return;
    }
    let found = false;
    const watch = navigator.geolocation.watchPosition(
      ({ coords }) => {
        found = true;
        const spot = { lat: coords.latitude, lng: coords.longitude };
        setLocation(inHyderabad(spot) ? { status: "on", spot, accuracy: coords.accuracy } : { status: "outside" });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setWanted(false);
          setLocation({ status: "denied" });
        } else if (!found) {
          setWanted(false);
          setLocation({ status: "unavailable" });
        }
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [wanted]);

  function locate() {
    if (location.status !== "on") setLocation({ status: "finding" });
    setWanted(true);
  }

  return { location, locate };
}
