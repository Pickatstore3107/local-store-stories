import type { BottomTabBarProps } from "expo-router/js-tabs";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { PAS, font } from "@/lib/pas";
import { useAuth } from "./auth-provider";

// The tab icons, copied from the prototype's ICON object.
const ICON = {
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z",
  map: "M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z M14.4 9.8a2.4 2.4 0 1 1-4.8 0a2.4 2.4 0 1 1 4.8 0Z",
  saved: "M6.5 4.5h11v15.5L12 16.2 6.5 20V4.5Z",
};

const TABS = [
  { id: "index", label: "Home" },
  { id: "map", label: "Map" },
  { id: "add", label: "Add Place" },
  { id: "saved", label: "Saved" },
  { id: "me", label: "Me" },
] as const;

/** Hidden while the keyboard is up, when the bar would only be in the way. */
function useTyping() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setTyping(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setTyping(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return typing;
}

/**
 * The bottom bar, the prototype's "notch" variant: Home, Map, Add Place,
 * Saved and Me, with a red pill that slides under the icon of the tab
 * you're on (not under Add Place or Me). Every style is copied from the
 * prototype. Add Place and Me need an account: guests go to sign in.
 */
export function BottomBar({ state, navigation }: BottomTabBarProps) {
  const { user, profile, consent } = useAuth();
  const insets = useSafeAreaInsets();
  const typing = useTyping();
  const member = user && consent && profile ? profile : null;
  const [width, setWidth] = useState(0);

  const ai = state.index;
  const activeTab = TABS[ai]?.id;
  const notchOk = activeTab !== "add" && activeTab !== "me";

  const left = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(notchOk ? 1 : 0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!width) return;
    const to = width * (ai * 0.2 + 0.1) - 20;
    if (!placed.current) {
      // Where it starts, without sliding in from the side.
      left.setValue(to);
      placed.current = true;
    } else {
      Animated.timing(left, {
        toValue: to,
        duration: 380,
        easing: Easing.bezier(0.3, 1.3, 0.5, 1),
        useNativeDriver: false,
      }).start();
    }
    Animated.timing(opacity, { toValue: notchOk ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [ai, width, notchOk, left, opacity]);

  if (typing) return null;

  function open(index: number) {
    const tab = TABS[index];
    if ((tab.id === "add" || tab.id === "me") && !member) {
      router.push(user ? "/welcome" : "/signin");
      return;
    }
    const route = state.routes.find((r) => r.name === tab.id);
    if (!route) return;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route.name);
  }

  return (
    <BlurView
      intensity={40}
      tint="light"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(255,255,255,0.96)",
        borderTopWidth: 1,
        borderTopColor: PAS.hairline,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        accessibilityRole="tablist"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ flexDirection: "row", height: 60 }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 6,
            left,
            width: 40,
            height: 30,
            borderRadius: 999,
            backgroundColor: PAS.red,
            opacity,
          }}
        />
        {TABS.map((tab, i) => {
          const on = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: on }}
              onPress={() => open(i)}
              style={{ flex: 1, alignItems: "center", gap: 4, paddingTop: 9 }}
            >
              {tab.id === "add" && (
                <View
                  style={{
                    width: 44,
                    height: 30,
                    marginTop: -3,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: PAS.red,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={PAS.red} strokeWidth={2.4} strokeLinecap="round">
                    <Path d="M12 6v12M6 12h12" />
                  </Svg>
                </View>
              )}
              {tab.id === "me" && (
                <View
                  style={[
                    {
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: PAS.red,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    // The prototype's ring: 2px white, then 2px yellow.
                    on && { borderWidth: 2, borderColor: "#fff", outlineWidth: 2, outlineColor: PAS.yellow, outlineStyle: "solid" },
                  ]}
                >
                  <Text style={[font("700 11px", "Plus Jakarta Sans"), { color: "#fff" }]}>
                    {member?.displayName.trim()[0]}
                  </Text>
                </View>
              )}
              {(tab.id === "index" || tab.id === "map" || tab.id === "saved") && (
                <Svg
                  viewBox="0 0 24 24"
                  width={22}
                  height={22}
                  fill={on && tab.id !== "map" ? "#fff" : "none"}
                  stroke={on ? "#fff" : PAS.soft}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d={ICON[tab.id === "index" ? "home" : tab.id]} />
                </Svg>
              )}
              <Text
                style={[
                  font(`${on ? 700 : 500} 10.5px`, "Plus Jakarta Sans"),
                  { color: on ? PAS.red : PAS.soft, marginTop: tab.id === "add" ? 1 : 0 },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BlurView>
  );
}
