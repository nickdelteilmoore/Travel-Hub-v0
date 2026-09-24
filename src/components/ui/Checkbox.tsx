import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "@/theme/useTheme";

export type CheckboxProps = {
  checked: boolean;
  onPress: () => void;
  size?: number;
  /** Fill / border colour when checked. Defaults to primary. */
  tint?: string;
  /** Tick colour on the filled state. Defaults to onPrimary. */
  onTint?: string;
};

/** A checkmark with a leaf-like curved tail. */
function LeafTick({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13 l4 4 Q11 12 13 9 T20 4"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Check-off control — fill + leaf-tick draw-on. 40dp tap target. */
export function Checkbox({ checked, onPress, size = 24, tint, onTint }: CheckboxProps) {
  const { colors, motion } = useTheme();
  const fill = tint ?? colors.primary;
  const tick = onTint ?? colors.onPrimary;
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, {
      duration: motion.fillTickMs,
    });
  }, [checked, motion.fillTickMs, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.6 + progress.value * 0.4 }],
  }));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: checked ? fill : colors.textMuted,
          backgroundColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              width: size,
              height: size,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: fill,
            },
            fillStyle,
          ]}
        >
          <LeafTick size={size - 6} color={tick} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
