import React from "react";
import { ScrollView, Text, View } from "react-native";

import { startupErrors, type StartupError } from "@/lib/startup";

// React error boundaries MUST be class components — there is no hook
// equivalent. This is the sanctioned exception to the functional-only rule:
// it turns a render crash (white/blank close) into a readable message.
type Props = { children: React.ReactNode };
type State = { error: Error | null };

const shell = { flex: 1, backgroundColor: "#0E1411", padding: 24, paddingTop: 72 } as const;
const heading = { color: "#D97A57", fontSize: 18, fontWeight: "600" as const, marginBottom: 12 };
const bodyText = { color: "#E9EBE4", fontSize: 13, lineHeight: 19 };

export function StartupErrorScreen({ errors }: { errors: StartupError[] }) {
  return (
    <View style={shell}>
      <Text style={heading}>Travel Hub couldn&apos;t start cleanly</Text>
      <ScrollView>
        {errors.map((e, i) => (
          <Text key={i} selectable style={[bodyText, { marginBottom: 12 }]}>
            {`• ${e.where}: ${e.message}`}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <View style={shell}>
          <Text style={heading}>Something went wrong</Text>
          <ScrollView>
            {startupErrors.length > 0 ? (
              <Text selectable style={[bodyText, { marginBottom: 16 }]}>
                {startupErrors.map((e) => `• ${e.where}: ${e.message}`).join("\n")}
              </Text>
            ) : null}
            <Text selectable style={bodyText}>
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}
