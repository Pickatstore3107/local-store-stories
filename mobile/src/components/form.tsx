import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import Svg, { Path } from "react-native-svg";
import { PAS, font } from "@/lib/pas";

/** A text box in the prototype's style: 44px, input fill, round ends. */
export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={PAS.placeholder}
      {...props}
      style={[
        font("500 14px", "Plus Jakarta Sans"),
        {
          height: 44,
          paddingHorizontal: 16,
          borderRadius: 999,
          backgroundColor: PAS.inputFill,
          color: PAS.ink,
        },
        props.style,
      ]}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={[font("700 13px", "Plus Jakarta Sans"), { color: PAS.ink, marginBottom: 8 }]}>{children}</Text>;
}

/** The red button, at 40% while it can't be pressed yet, as in the prototype. */
export function RedButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={{
        height: 48,
        borderRadius: 999,
        backgroundColor: PAS.red,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={[font("700 15px", "Plus Jakarta Sans"), { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (next: boolean) => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          marginTop: 1,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? PAS.red : PAS.border,
          backgroundColor: checked ? PAS.red : "#fff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && (
          <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 12.5l4.5 4.5L19 7.5" />
          </Svg>
        )}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" style={[font("500 13px", "Plus Jakarta Sans"), { color: PAS.deepRed, marginTop: 14 }]}>
      {children}
    </Text>
  );
}
