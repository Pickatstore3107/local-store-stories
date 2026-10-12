import { View } from "react-native";
import { PhoneHeader } from "@/components/phone-header";

// Activity: copied from the prototype in a later step.
export default function Activity() {
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <PhoneHeader />
    </View>
  );
}
