import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { PAS, font } from "@/lib/pas";

/**
 * The header, copied from the prototype: the logo, the city and the bell on
 * a 52px blurred white strip at the top, below the phone's status bar.
 */
export function PhoneHeader() {
  const insets = useSafeAreaInsets();
  return (
    <BlurView intensity={30} tint="light" style={{ paddingTop: insets.top, backgroundColor: "rgba(255,255,255,0.94)" }}>
      <View
        style={{
          height: 52,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 16,
          paddingRight: 14,
        }}
      >
        <Link href="/" accessibilityLabel="Local Stores & Their Stories home">
          <Image
            source={require("../../assets/pas-logo-horizontal.webp")}
            accessibilityLabel="Pick at Store"
            style={{ height: 26, width: (26 * 900) / 419 }}
          />
        </Link>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            accessibilityLabel="Hyderabad"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: PAS.butterLight,
            }}
          >
            <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={PAS.red} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
            </Svg>
            <Text style={[font("600 12.5px", "Plus Jakarta Sans"), { color: PAS.ink }]}>Hyderabad</Text>
          </View>
          <Link href="/activity" asChild>
            <Pressable
              accessibilityLabel="Activity"
              style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            >
              <Svg viewBox="0 0 24 24" width={23} height={23} fill="none" stroke={PAS.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Zm4 3a2 2 0 0 0 4 0" />
              </Svg>
            </Pressable>
          </Link>
        </View>
      </View>
    </BlurView>
  );
}
