import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { BottomBar } from "@/components/bottom-bar";
import { PhoneHeader } from "@/components/phone-header";
import { useAuth } from "@/components/auth-provider";

export default function TabsLayout() {
  const { user, guest } = useAuth();
  // First time in: sign in, or look around as a guest.
  if (!user && !guest) return <Redirect href="/signin" />;

  return (
    <Tabs
      tabBar={(props) => <BottomBar {...props} />}
      screenOptions={{
        header: () => <PhoneHeader />,
        sceneStyle: { backgroundColor: "#fff" },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
