import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { PAS, font } from "@/lib/pas";
import { REPORT_DETAILS_MAX, REPORT_DETAILS_MIN } from "@/lib/reports";
import { ErrorNote, RedButton } from "./form";

/**
 * Choosing why something is reported, as the website's report forms: one
 * reason, and a few words that are needed only for "other".
 */
export function ReportForm<R extends string>({
  title,
  note,
  reasons,
  onSend,
  onCancel,
}: {
  title: string;
  note: string;
  reasons: readonly (readonly [R, string])[];
  /** Resolves when sent; throws a message people can read. */
  onSend: (reason: R, details: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<R | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason || busy) return;
    const text = details.trim();
    if (reason === "other" && text.length < REPORT_DETAILS_MIN) {
      setError("Please tell us a little about what's wrong.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSend(reason, text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: PAS.border, padding: 16, gap: 10, backgroundColor: "#fff" }}>
      <Text accessibilityRole="header" style={[font("700 15px", "Plus Jakarta Sans"), { color: PAS.ink }]}>{title}</Text>
      <Text style={[font("400 13px", "Plus Jakarta Sans"), { color: PAS.soft }]}>{note}</Text>
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        {reasons.map(([value, label]) => {
          const on = reason === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => {
                setReason(value);
                setError(null);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: on ? PAS.yellow : PAS.border, backgroundColor: on ? PAS.butterLight : "#fff" }}
            >
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: on ? PAS.red : PAS.border, alignItems: "center", justifyContent: "center" }}>
                {on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PAS.red }} />}
              </View>
              <Text style={[font("500 13.5px", "Plus Jakarta Sans"), { color: PAS.ink, flex: 1 }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[font("700 13px", "Plus Jakarta Sans"), { color: PAS.ink, marginTop: 4 }]}>
        Anything else?{" "}
        <Text style={[font("400 13px", "Plus Jakarta Sans"), { color: PAS.soft }]}>{reason === "other" ? "(needed)" : "(optional)"}</Text>
      </Text>
      <TextInput
        value={details}
        onChangeText={(t) => {
          setDetails(t);
          setError(null);
        }}
        maxLength={REPORT_DETAILS_MAX}
        multiline
        accessibilityLabel="Anything else"
        style={[font("500 14px", "Plus Jakarta Sans"), { minHeight: 64, padding: 12, borderRadius: 14, backgroundColor: PAS.inputFill, color: PAS.ink, textAlignVertical: "top" }]}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <RedButton label={busy ? "Sending…" : "Send report"} onPress={submit} disabled={busy || !reason} />
      <Pressable accessibilityRole="button" onPress={onCancel} style={{ alignSelf: "center", padding: 8 }}>
        <Text style={[font("700 13px", "Plus Jakarta Sans"), { color: PAS.soft }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}

/** A green note after something was sent. */
export function DoneNote({ children }: { children: string }) {
  return (
    <Text accessibilityRole="alert" style={[font("500 13.5px", "Plus Jakarta Sans"), { color: "#14532D", backgroundColor: "#ECFDF5", padding: 12, borderRadius: 14, overflow: "hidden" }]}>
      {children}
    </Text>
  );
}
