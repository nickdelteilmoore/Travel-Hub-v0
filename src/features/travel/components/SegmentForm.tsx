import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { Text, TextField, DateField, TimeField, Button, Chip } from "@/components/ui";
import { useTheme } from "@/theme/useTheme";
import { toast } from "@/stores/uiStore";
import { useAuth } from "@/features/auth/AuthProvider";
import { useSegment, useSegmentTypes } from "../queries";
import { useSaveSegment, useDeleteSegment } from "../mutations";
import type { SegmentFormInput } from "../segmentForm";
import { instantToDay } from "../domain/dates";
import { localTime } from "../domain/timezone";

type FormState = {
  segment_type: string;
  title: string;
  carrier: string;
  number: string;
  depart_iata: string;
  depart_place: string;
  depart_day: string | null;
  depart_time: string | null;
  arrive_iata: string;
  arrive_place: string;
  arrive_day: string | null;
  arrive_time: string | null;
  booking_ref: string;
  seat: string;
  cabin: string;
  notes: string;
};

const EMPTY: FormState = {
  segment_type: "flight",
  title: "",
  carrier: "",
  number: "",
  depart_iata: "",
  depart_place: "",
  depart_day: null,
  depart_time: null,
  arrive_iata: "",
  arrive_place: "",
  arrive_day: null,
  arrive_time: null,
  booking_ref: "",
  seat: "",
  cabin: "",
  notes: "",
};

/** Add or edit one segment by hand. `editId` prefills from an existing row;
 * `tripId` pins a new segment to a trip (otherwise it resolves/opens one). */
export function SegmentForm({ editId, tripId }: { editId?: string; tripId?: string }) {
  const { spacing } = useTheme();
  const router = useRouter();
  const { userId } = useAuth();

  const { data: existing } = useSegment(editId);
  const { data: types } = useSegmentTypes();
  const save = useSaveSegment();
  const remove = useDeleteSegment();

  const [form, setForm] = useState<FormState>(EMPTY);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!existing) return;
    setForm({
      segment_type: existing.segment_type,
      title: existing.title ?? "",
      carrier: existing.carrier ?? "",
      number: existing.number ?? "",
      depart_iata: existing.depart_iata ?? "",
      depart_place: existing.depart_place ?? "",
      depart_day: instantToDay(existing.depart_at, existing.depart_tz || undefined),
      depart_time: existing.depart_at ? localTime(existing.depart_at, existing.depart_tz) : null,
      arrive_iata: existing.arrive_iata ?? "",
      arrive_place: existing.arrive_place ?? "",
      arrive_day: instantToDay(existing.arrive_at, existing.arrive_tz || existing.depart_tz || undefined),
      arrive_time: existing.arrive_at ? localTime(existing.arrive_at, existing.arrive_tz || existing.depart_tz) : null,
      booking_ref: existing.booking_ref ?? "",
      seat: existing.seat ?? "",
      cabin: existing.cabin ?? "",
      notes: existing.notes ?? "",
    });
  }, [existing]);

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace("/travel"));

  async function submit() {
    if (!userId) return;
    if (!form.depart_day || !form.depart_time) {
      toast("A start date and time are needed");
      return;
    }
    const input: SegmentFormInput = {
      id: editId,
      trip_id: tripId ?? existing?.trip_id ?? null,
      segment_type: form.segment_type,
      title: form.title,
      carrier: form.carrier,
      number: form.number,
      cabin: form.cabin,
      seat: form.seat,
      booking_ref: form.booking_ref,
      notes: form.notes,
      depart_iata: form.depart_iata,
      depart_place: form.depart_place,
      arrive_iata: form.arrive_iata,
      arrive_place: form.arrive_place,
      depart_day: form.depart_day,
      depart_time: form.depart_time,
      arrive_day: form.arrive_day ?? undefined,
      arrive_time: form.arrive_time ?? undefined,
    };
    // Fire-and-forget: the optimistic segment shows in the itinerary at once and
    // the write runs (or queues, offline) in the background — awaiting would hang
    // the screen with no connection. Errors roll back with a snackbar.
    save.mutate({ input, travellerId: userId });
    dismiss();
  }

  const typeList = types ? [...types.values()] : [];

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" color="textMuted">
          Type
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
          {typeList.map((t) => (
            <Chip
              key={t.code}
              label={t.label}
              selected={form.segment_type === t.code}
              onPress={() => set("segment_type", t.code)}
            />
          ))}
        </View>
      </View>

      <TextField label="Title" value={form.title} onChangeText={(v) => set("title", v)} placeholder="Hotel Ciutat" />
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField label="Operator" value={form.carrier} onChangeText={(v) => set("carrier", v)} placeholder="BA" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Number" value={form.number} onChangeText={(v) => set("number", v)} placeholder="478" />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="From (IATA)"
            value={form.depart_iata}
            onChangeText={(v) => set("depart_iata", v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
            placeholder="LHR"
          />
        </View>
        <View style={{ flex: 2 }}>
          <TextField label="From (place)" value={form.depart_place} onChangeText={(v) => set("depart_place", v)} />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <DateField label="Departs" value={form.depart_day} onChange={(v) => set("depart_day", v)} clearable={false} />
        </View>
        <View style={{ flex: 1 }}>
          <TimeField label="at" value={form.depart_time} onChange={(v) => set("depart_time", v)} />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="To (IATA)"
            value={form.arrive_iata}
            onChangeText={(v) => set("arrive_iata", v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
            placeholder="BCN"
          />
        </View>
        <View style={{ flex: 2 }}>
          <TextField label="To (place)" value={form.arrive_place} onChangeText={(v) => set("arrive_place", v)} />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <DateField label="Arrives" value={form.arrive_day} onChange={(v) => set("arrive_day", v)} />
        </View>
        <View style={{ flex: 1 }}>
          <TimeField label="at" value={form.arrive_time} onChange={(v) => set("arrive_time", v)} />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField label="Reference" value={form.booking_ref} onChangeText={(v) => set("booking_ref", v)} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Seat / room" value={form.seat} onChangeText={(v) => set("seat", v)} />
        </View>
      </View>
      <TextField label="Cabin" value={form.cabin} onChangeText={(v) => set("cabin", v)} placeholder="economy" />
      <TextField
        label="Notes"
        value={form.notes}
        onChangeText={(v) => set("notes", v)}
        multiline
        style={{ minHeight: 80, paddingTop: 12 }}
      />

      <Button
        label={editId ? "Save segment" : "Add segment"}
        onPress={submit}
        loading={save.isPending}
        disabled={!form.depart_day || !form.depart_time}
        fullWidth
      />
      {editId ? (
        <Button
          label="Delete segment"
          variant="ghost"
          onPress={() => {
            remove.mutate(editId);
            dismiss();
          }}
        />
      ) : null}
    </ScrollView>
  );
}
