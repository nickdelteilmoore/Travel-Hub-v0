import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { Text, TextField, DateField, Button, LeafCard } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { toast } from "@/stores/uiStore";
import { useAuth } from "@/features/auth/AuthProvider";
import { useExpense, useReceiptUrls } from "../queries";
import { useSaveExpense, useDeleteExpense } from "../mutations";
import {
  parseReceiptText,
  type ExpenseFields,
} from "../expenses";

/** On-device OCR (Google ML Kit), loaded lazily so a build without the native
 * module — or a failure to recognise — degrades to the AI backup rather than
 * crashing. Returns "" when no text could be read. */
async function runOcr(uri: string): Promise<string> {
  try {
    const mod = await import("@react-native-ml-kit/text-recognition");
    const result = await mod.default.recognize(uri);
    return result?.text ?? "";
  } catch {
    return "";
  }
}

/**
 * Photograph a receipt (or pick one), read it with on-device OCR plus the AI
 * backup, then confirm/edit the fields (DESIGN.md). Nothing is auto-saved:
 * unreadable fields come back blank for the user to fill. Also the edit form
 * for an existing expense.
 */
export function ExpenseForm({ tripId, editId }: { tripId?: string; editId?: string }) {
  const { spacing, radii, colors } = useTheme();
  const palette = useMiniAppPalette("travel");
  const router = useRouter();
  const { userId } = useAuth();

  const { data: existing } = useExpense(editId);
  const save = useSaveExpense();
  const remove = useDeleteExpense();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const [spentOn, setSpentOn] = useState<string | null>(null);
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  // A signed URL to preview the already-stored photo when editing.
  const { data: urls } = useReceiptUrls([existing?.photo_path ?? null]);
  const existingUrl = existing?.photo_path ? urls?.get(existing.photo_path) : undefined;

  const resolvedTripId = tripId ?? existing?.trip_id ?? undefined;

  useEffect(() => {
    if (!existing) return;
    setSpentOn(existing.spent_on);
    setCurrency(existing.currency ?? "");
    setAmount(existing.amount != null ? String(existing.amount) : "");
    setReason(existing.reason ?? "");
    setExistingPhotoPath(existing.photo_path);
  }, [existing]);

  async function ingest(uri: string) {
    setProcessing(true);
    try {
      const out = await manipulateAsync(uri, [{ resize: { width: 1600 } }], {
        compress: 0.6,
        format: SaveFormat.JPEG,
        base64: true,
      });
      setPhotoUri(out.uri);
      setPhotoBase64(out.base64 ?? null);

      const text = await runOcr(uri);
      // On-device OCR only — receipt text never leaves the phone.
      const merged: ExpenseFields = parseReceiptText(text);
      // Fill only blanks — never clobber something the user already typed.
      setSpentOn((v) => v ?? merged.spent_on);
      setCurrency((v) => v || (merged.currency ?? ""));
      setAmount((v) => v || (merged.amount != null ? String(merged.amount) : ""));
      setReason((v) => v || (merged.reason ?? ""));
    } catch {
      toast("Couldn't read that photo — enter the details by hand");
    } finally {
      setProcessing(false);
    }
  }

  async function pick(source: "camera" | "library") {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast("Photo permission is needed to add a receipt");
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    const asset = result.canceled ? null : result.assets?.[0];
    if (asset?.uri) await ingest(asset.uri);
  }

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace("/travel"));

  async function submit() {
    if (!userId || !resolvedTripId) {
      toast("Couldn't tell which trip this belongs to");
      return;
    }
    const parsedAmount = amount.trim() ? Number(amount.trim().replace(",", ".")) : null;
    if (parsedAmount != null && !Number.isFinite(parsedAmount)) {
      toast("That amount isn't a number");
      return;
    }
    const fields: ExpenseFields = {
      spent_on: spentOn,
      currency: currency.trim() ? currency.trim().toUpperCase() : null,
      amount: parsedAmount,
      reason: reason.trim() ? reason.trim() : null,
    };
    // Fire-and-forget so the form closes at once and the save runs (or queues,
    // offline) in the background; the optimistic row shows it in the list
    // immediately. A queued photo uploads when the write reaches the network.
    save.mutate({
      id: editId,
      tripId: resolvedTripId,
      travellerId: userId,
      fields,
      photoBase64: photoBase64 ?? undefined,
      existingPhotoPath,
    });
    dismiss();
  }

  const previewUri = photoUri ?? existingUrl ?? null;
  const hasContent = !!(photoBase64 || existingPhotoPath || amount.trim() || reason.trim());

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 }}>
      {previewUri ? (
        <Image
          source={{ uri: previewUri }}
          style={{ width: "100%", height: 220, borderRadius: radii.md, backgroundColor: colors.surfaceAlt }}
          resizeMode="cover"
          accessibilityLabel="Receipt photo"
        />
      ) : (
        <LeafCard appId="travel">
          <View style={{ alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm }}>
            <Text variant="bodyMedium" style={{ color: palette.text }}>
              Add a receipt
            </Text>
            <Text variant="caption" color="textMuted" style={{ textAlign: "center" }}>
              Snap the receipt and we&apos;ll try to read the date, amount, currency and what it was
              for. You can fix anything below.
            </Text>
          </View>
        </LeafCard>
      )}

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button label="Take photo" onPress={() => pick("camera")} disabled={processing} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={previewUri ? "Replace" : "Choose photo"}
            variant="secondary"
            onPress={() => pick("library")}
            disabled={processing}
            fullWidth
          />
        </View>
      </View>

      {processing ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <ActivityIndicator color={palette.accent} />
          <Text variant="caption" color="textMuted">
            Reading the receipt…
          </Text>
        </View>
      ) : null}

      <DateField label="Date" value={spentOn} onChange={setSpentOn} />
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 2 }}>
          <TextField
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Currency"
            value={currency}
            onChangeText={(v) => setCurrency(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
            placeholder="EUR"
          />
        </View>
      </View>
      <TextField
        label="Reason"
        value={reason}
        onChangeText={setReason}
        placeholder="Dinner, taxi, museum…"
      />

      <Button
        label={editId ? "Save expense" : "Add expense"}
        onPress={submit}
        loading={save.isPending}
        disabled={processing || !hasContent}
        fullWidth
      />
      {editId ? (
        <Button
          label="Delete expense"
          variant="ghost"
          onPress={() => {
            remove.mutate({
              id: editId,
              tripId: resolvedTripId ?? "",
              photoPath: existingPhotoPath,
            });
            dismiss();
          }}
        />
      ) : (
        <Pressable onPress={dismiss} hitSlop={8} style={{ alignSelf: "center", padding: spacing.sm }}>
          <Text variant="caption" color="textMuted">
            Cancel
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
