import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { PersonScreen } from "@/components/person-screen";
import { PhoneHeader } from "@/components/phone-header";

/** Someone's profile, as the website's src/app/people/[uid]/. */
export default function Person() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <PhoneHeader back />
      <PersonScreen uid={uid} />
    </View>
  );
}
