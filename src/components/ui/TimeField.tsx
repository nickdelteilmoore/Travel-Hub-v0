import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Clock, X } from "lucide-react-native";

import { useTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export type TimeFieldProps = {
  label?: string;
  /** HH:mm (24h) or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  clearable?: boolean;
};

/** DateField's counterpart, for a kickoff time. 24h, en-GB. */
export function TimeField({
  label,
  value,
  onChange,
  clearable = true,
}: TimeFieldProps) {
  const { colors, radii, spacing } = useTheme();
  const [open, setOpen] = useState(false);

  // The picker wants a Date; only its clock face is ever read.
  const asDate = () => {
    const base = new Date();
    const [hours, minutes] = (value ?? "15:00").split(":");
    base.setHours(Number(hours ?? 15), Number(minutes ?? 0), 0, 0);
    return base;
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={label ?? "Time"}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            minHeight: 48,
          }}
        >
          <Clock size={18} color={colors.textMuted} />
          <Text variant="body" color={value ? "text" : "textMuted"}>
            {value ?? "Not set"}
          </Text>
        </Pressable>
        {clearable && value ? (
          <Pressable
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel="Clear time"
            hitSlop={8}
            style={{ padding: 8 }}
          >
            <X size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <DateTimePicker
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          value={asDate()}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === "set" && date) {
              onChange(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
            }
          }}
        />
      ) : null}
    </View>
  );
}
