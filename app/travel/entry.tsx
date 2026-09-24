import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { isAfter, parseISO } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen, AppHeader, Text, TextField, DateField, Button } from "@/components/ui";
import { useTheme, useMiniAppTint } from "@/theme/useTheme";
import { useUiStore } from "@/stores/uiStore";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTravelEntry, type Country } from "@/features/travel/queries";
import { useSaveTravelEntry, useDeleteTravelEntry } from "@/features/travel/mutations";
import { CountryPicker } from "@/features/travel/components/CountryPicker";

export default function TravelEntryScreen() {
  const { colors, radii, spacing } = useTheme();
  const tint = useMiniAppTint("travel");
  const router = useRouter();
  const { userId } = useAuth();
  const showSnackbar = useUiStore((s) => s.showSnackbar);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const { data: existing } = useTravelEntry(id);
  const save = useSaveTravelEntry();
  const remove = useDeleteTravelEntry();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [country, setCountry] = useState<Country | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState<string | null>(null);
  const [stillHere, setStillHere] = useState(false);
  const [exitDate, setExitDate] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!existing) return;
    setCountryCode(existing.country_code);
    setEntryDate(existing.entry_date);
    setExitDate(existing.exit_date);
    setStillHere(existing.exit_date === null);
    setNotes(existing.notes ?? "");
  }, [existing]);

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace("/travel"));
  const code = country?.code ?? countryCode;

  async function submit() {
    if (!userId || !code || !entryDate) return;
    const finalExit = stillHere ? null : exitDate;
    if (finalExit && isAfter(parseISO(entryDate), parseISO(finalExit))) {
      showSnackbar("Exit date can't be before entry date");
      return;
    }
    // Fire-and-forget: the optimistic update shows the trip at once and the
    // write runs (or queues, offline) in the background — so awaiting here would
    // hang the screen with no connection. Errors roll back with a snackbar.
    save.mutate({
      id: editing ? id : undefined,
      traveler_id: userId,
      country_code: code,
      entry_date: entryDate,
      exit_date: finalExit,
      notes: notes.trim() || null,
    });
    dismiss();
  }

  return (
    <Screen>
      <AppHeader title={editing ? "Edit trip" : "New trip"} tint={tint} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="textMuted">Country</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={{ backgroundColor: colors.surfaceAlt, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, minHeight: 48, justifyContent: "center" }}
          >
            <Text variant="body" color={country || countryCode ? "text" : "textMuted"}>
              {country ? `${country.flag_emoji}  ${country.name}` : countryCode ?? "Choose a country"}
            </Text>
          </Pressable>
        </View>

        <DateField label="Entry date" value={entryDate} onChange={setEntryDate} clearable={false} />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="bodyMedium">Still here</Text>
          <Switch value={stillHere} onValueChange={setStillHere} trackColor={{ true: colors.primary }} />
        </View>

        {!stillHere ? <DateField label="Exit date" value={exitDate} onChange={setExitDate} /> : null}

        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 80, paddingTop: 12 }} />

        <Button label={editing ? "Save trip" : "Add trip"} onPress={submit} loading={save.isPending} disabled={!code || !entryDate} fullWidth />

        {editing ? (
          <Button label="Delete trip" variant="ghost" onPress={() => { remove.mutate(id as string); dismiss(); }} />
        ) : null}
      </ScrollView>

      <CountryPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(c) => { setCountry(c); setCountryCode(c.code); }}
      />
    </Screen>
  );
}
