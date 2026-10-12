import { Text, View } from "react-native";
import { PAS, font } from "@/lib/pas";

/** The map needs a phone; the web preview, used only for checking screens, says so. */
export function MapScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={[font("500 15px", "Plus Jakarta Sans"), { color: PAS.soft, textAlign: "center" }]}>The map opens on a phone.</Text>
    </View>
  );
}
