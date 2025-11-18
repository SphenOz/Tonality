import TonalityProvider from "@/utils/tonalityContext";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <TonalityProvider>
      <Stack />
    </TonalityProvider>
  );
}
