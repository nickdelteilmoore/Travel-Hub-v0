import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";

import { useTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/** Lightweight bottom sheet for in-screen pickers (e.g. the country picker). */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const { colors, radii, spacing } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}
      >
        <Pressable
          // Swallow taps inside the panel so they don't dismiss.
          onPress={() => {}}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
            padding: spacing.lg,
            paddingBottom: spacing["2xl"],
            gap: spacing.md,
            maxHeight: "80%",
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
            }}
          />
          {title ? <Text variant="heading">{title}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
