import { Image } from "expo-image";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/components/auth-provider";
import { ErrorNote, Field, Label, RedButton } from "@/components/form";
import { loadAccount } from "@/lib/account";
import { friendlyError } from "@/lib/auth-errors";
import { firebase } from "@/lib/firebase";
import { PAS, font } from "@/lib/pas";

/**
 * Sign in for testing in Expo Go, where Google sign-in can't open: a test
 * login (email and password, made in Firebase), or look around as a guest.
 */
export default function SignIn() {
  const { setGuest } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = email.trim().length > 3 && password.length > 0;

  async function signIn() {
    setError(null);
    setBusy(true);
    try {
      const { user } = await signInWithEmailAndPassword(firebase.auth, email.trim(), password);
      setGuest(false);
      const { consent } = await loadAccount(user.uid);
      router.replace(consent ? "/" : "/welcome");
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  function asGuest() {
    setGuest(true);
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#fff" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 18,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Image
          source={require("../../assets/pas-emblem.png")}
          accessibilityLabel="Pick at Store"
          style={{ width: 84, height: (84 * 788) / 750, alignSelf: "center" }}
        />
        <Text style={[font("600 32px", "Playfair Display"), { color: PAS.ink, textAlign: "center", marginTop: 22 }]}>
          Join the campaign
        </Text>

        <View style={{ marginTop: 28 }}>
          <Label>Email</Label>
          <Field
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
          />
        </View>
        <View style={{ marginTop: 14 }}>
          <Label>Password</Label>
          <Field
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            onSubmitEditing={() => ready && !busy && signIn()}
          />
        </View>

        <View style={{ marginTop: 22 }}>
          <RedButton label={busy ? "Signing in…" : "Sign in"} onPress={signIn} disabled={!ready || busy} />
        </View>
        {error && <ErrorNote>{error}</ErrorNote>}

        <Pressable accessibilityRole="button" onPress={asGuest} style={{ marginTop: 18, paddingVertical: 10, alignSelf: "center" }}>
          <Text style={[font("700 14px", "Plus Jakarta Sans"), { color: PAS.red }]}>Continue as guest</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
