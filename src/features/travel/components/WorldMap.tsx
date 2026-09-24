import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "@/theme/useTheme";
import { COUNTRY_PATHS, WORLD_VIEWBOX } from "../worldMap";

// spec-mandated choropleth fills (literal by design, like the flag circle).
const UNVISITED = "#E4ECEE"; // Soft Ice Slate
const VISITED_LIGHT = "#23464C"; // Deep Slate
const VISITED_DARK = "#8FA98C"; // Soft Sage

export function WorldMap({ visited }: { visited: Set<string> }) {
  const { scheme, colors } = useTheme();
  const visitedFill = scheme === "dark" ? VISITED_DARK : VISITED_LIGHT;

  return (
    <View style={{ width: "100%", aspectRatio: 2 }} accessibilityLabel="World map of visited countries">
      <Svg width="100%" height="100%" viewBox={WORLD_VIEWBOX}>
        {COUNTRY_PATHS.map((c, i) => (
          <Path
            key={i}
            d={c.d}
            fill={c.code && visited.has(c.code) ? visitedFill : UNVISITED}
            stroke={colors.bg}
            strokeWidth={0.4}
          />
        ))}
      </Svg>
    </View>
  );
}
