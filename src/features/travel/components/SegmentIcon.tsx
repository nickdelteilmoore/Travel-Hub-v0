import {
  Plane,
  TrainFront,
  Ship,
  Bus,
  Car,
  BedDouble,
  Building2,
  Users,
  Ticket,
  Utensils,
  FileCheck,
  StickyNote,
  MapPin,
  type LucideIcon,
} from "lucide-react-native";

/** Segment-type code → glyph. The web hub distinguishes types by silhouette
 * (the `leaf` column); on the phone a lucide icon carries the same meaning. */
const ICONS: Record<string, LucideIcon> = {
  flight: Plane,
  train: TrainFront,
  ferry: Ship,
  bus: Bus,
  car_hire: Car,
  hotel: BedDouble,
  apartment: Building2,
  meeting: Users,
  activity: Ticket,
  restaurant: Utensils,
  visa: FileCheck,
  note: StickyNote,
};

export function SegmentIcon({
  code,
  size = 18,
  color,
}: {
  code: string;
  size?: number;
  color: string;
}) {
  const Icon = ICONS[code] ?? MapPin;
  return <Icon size={size} color={color} strokeWidth={2} />;
}
