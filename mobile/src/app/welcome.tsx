import { Redirect, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/components/auth-provider";
import { Check, ErrorNote, Field, Label, RedButton } from "@/components/form";
import { CITY_MAX, CITY_MIN, NAME_MAX, createAccount } from "@/lib/account";
import { friendlyError } from "@/lib/auth-errors";
import { MIN_AGE } from "@/lib/consent";
import { PAS, font } from "@/lib/pas";

const SITE = "https://local-store-stories.vercel.app";

/**
 * The website's welcome screen: what is shown publicly and what stays
 * private, a name and city, and consent. Same words, same consent version.
 */
export default function Welcome() {
  const { user, consent, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState(user?.displayName?.slice(0, NAME_MAX) ?? "");
  const [city, setCity] = useState("");
  const [adult, setAdult] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <Redirect href="/signin" />;
  if (consent) return <Redirect href="/" />;
  const uid = user.uid;

  const nameOk = displayName.trim().length >= 1 && displayName.trim().length <= NAME_MAX;
  const cityOk = city.trim().length >= CITY_MIN && city.trim().length <= CITY_MAX;
  const ready = nameOk && cityOk && adult && agreed;

  async function submit() {
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      await createAccount(uid, { displayName, city });
      await refresh();
      router.replace("/");
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  const body = [font("400 14px", "Plus Jakarta Sans"), { color: PAS.soft, lineHeight: 20 }];
  const link = [font("700 14px", "Plus Jakarta Sans"), { color: PAS.red, textDecorationLine: "underline" as const }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#fff" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
      >
        <Text style={[font("600 30px", "Playfair Display"), { color: PAS.ink }]}>Welcome! Before you begin</Text>
        <Text style={[body, { marginTop: 8 }]}>
          Your posts are yours. Here is exactly what we show and what we keep private.
        </Text>

        <View style={{ marginTop: 20, gap: 12 }}>
          <View style={{ borderRadius: 16, backgroundColor: PAS.butterLight, padding: 16 }}>
            <Text style={[font("700 14px", "Plus Jakarta Sans"), { color: PAS.ink }]}>Shown publicly</Text>
            {[
              "The name you choose below",
              "Your city",
              "Posts you choose to share",
              "Who you follow, and who follows you",
              "Posts you like, and comments you write",
              "Who invited you, if you join through a friend's invite",
            ].map((line) => (
              <Text key={line} style={[body, { marginTop: 4 }]}>{`•  ${line}`}</Text>
            ))}
          </View>
          <View style={{ borderRadius: 16, backgroundColor: PAS.inputFill, padding: 16 }}>
            <Text style={[font("700 14px", "Plus Jakarta Sans"), { color: PAS.ink }]}>Always private</Text>
            {["Your email address", "Your exact location", "We never sell your data"].map((line) => (
              <Text key={line} style={[body, { marginTop: 4 }]}>{`•  ${line}`}</Text>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 22 }}>
          <Label>Name to show on your stories</Label>
          <Field value={displayName} onChangeText={setDisplayName} maxLength={NAME_MAX} placeholder="e.g. Priya S." />
        </View>
        <View style={{ marginTop: 14 }}>
          <Label>Your city</Label>
          <Field value={city} onChangeText={setCity} maxLength={CITY_MAX} placeholder="e.g. Hyderabad" />
        </View>

        <View style={{ marginTop: 22, gap: 14 }}>
          <Check checked={adult} onChange={setAdult}>
            <Text style={[body, { color: PAS.ink }]}>I am {MIN_AGE} years or older.</Text>
          </Check>
          <Check checked={agreed} onChange={setAgreed}>
            <Text style={[body, { color: PAS.ink }]}>
              I agree that my name, city, the stories I publish, who I follow and who follows me, and
              who invited me (if anyone did) can be shown publicly, as described in the{" "}
              <Text style={link} onPress={() => Linking.openURL(`${SITE}/privacy`)}>
                privacy notice
              </Text>
              . I can edit or delete them, and my account, at any time.
            </Text>
          </Check>
        </View>

        <View style={{ marginTop: 22 }}>
          <RedButton label={busy ? "Saving…" : "Agree and continue"} onPress={submit} disabled={!ready || busy} />
        </View>
        <Text style={[font("400 12px", "Plus Jakarta Sans"), { color: PAS.soft, textAlign: "center", marginTop: 12 }]}>
          By joining, you also agree to the{" "}
          <Text style={[link, { fontSize: 12 }]} onPress={() => Linking.openURL(`${SITE}/terms`)}>
            terms and conditions
          </Text>
          .
        </Text>
        {error && <ErrorNote>{error}</ErrorNote>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
