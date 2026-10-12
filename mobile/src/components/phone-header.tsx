import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { watchBell } from "@/lib/follows";
import { PAS, font } from "@/lib/pas";
import { useAuth } from "./auth-provider";

/** Whether someone followed you since you last looked at Activity. */
function useBellRinging() {
  const { user, consent } = useAuth();
  const uid = user && consent ? user.uid : null;
  const [bell, setBell] = useState<{ uid: string; ringing: boolean } | null>(null);
  useEffect(() => {
    if (!uid) return;
    return watchBell(uid, ({ ringAt, seenAt }) => setBell({ uid, ringing: ringAt > seenAt }));
  }, [uid]);
  return !!uid && bell?.uid === uid && bell.ringing;
}

/**
 * The header, copied from the prototype: the logo, the city and the bell on
 * a 52px blurred white strip at the top, below the phone's status bar. On
 * screens opened from a tab, `back` adds a way back.
 */
export function PhoneHeader({ back = false }: { back?: boolean }) {
  const insets = useSafeAreaInsets();
  const ringing = useBellRinging();
  return (
    <BlurView intensity={30} tint="light" style={{ paddingTop: insets.top, backgroundColor: "rgba(255,255,255,0.94)" }}>
      <View
        style={{
          height: 52,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: back ? 6 : 16,
          paddingRight: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          {back && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
              style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            >
              <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={PAS.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M14.5 6 8.5 12l6 6" /></Svg>
            </Pressable>
          )}
          <Link href="/" accessibilityLabel="Local Stores & Their Stories home">
            <Image
              source={require("../../assets/pas-logo-horizontal.webp")}
              accessibilityLabel="Pick at Store"
              style={{ height: 26, width: (26 * 900) / 419 }}
            />
          </Link>
        </View>
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
              accessibilityLabel={ringing ? "Activity, new" : "Activity"}
              style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            >
              <Svg viewBox="0 0 24 24" width={23} height={23} fill="none" stroke={PAS.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Zm4 3a2 2 0 0 0 4 0" />
              </Svg>
              {ringing && (
                <View style={{ position: "absolute", top: 8, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: PAS.red, borderWidth: 2, borderColor: "#fff" }} />
              )}
            </Pressable>
          </Link>
        </View>
      </View>
    </BlurView>
  );
}
