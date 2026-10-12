import { Text } from "react-native";
import type { Pin } from "@/lib/pins";
import { PAS, font } from "@/lib/pas";

/** The map needs a phone; the web preview, used only for checking screens, says so. */
export function PinPicker(_: { value: Pin | null; onChange: (pin: Pin | null) => void; neighbourhood?: string }) {
  return <Text style={[font("500 13px", "Plus Jakarta Sans"), { color: PAS.soft }]}>The map opens on a phone.</Text>;
}
