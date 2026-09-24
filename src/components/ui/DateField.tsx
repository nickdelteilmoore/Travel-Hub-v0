import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react-native";

import { useTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export type DateFieldProps = {
  label?: string;
  /** yyyy-MM-dd or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  clearable?: boolean;
};

export function DateField({ label, value, onChange, clearable = true }: DateFieldProps) {
  const { colors, radii, spacing } = useTheme();
  const [open, setOpen] = useState(false);

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
          <CalendarDays size={18} color={colors.textMuted} />
          <Text variant="body" color={value ? "text" : "textMuted"}>
            {value ? format(parseISO(value), "d MMM yyyy", { locale: enGB }) : "Not set"}
          </Text>
        </Pressable>
        {clearable && value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8} style={{ padding: 8 }}>
            <X size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <DateTimePicker
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          value={value ? parseISO(value) : new Date()}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === "set" && date) onChange(format(date, "yyyy-MM-dd"));
          }}
        />
      ) : null}
    </View>
  );
}
