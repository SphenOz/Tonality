import { tonalityContext } from "@/utils/tonalityContext";
import React, { useContext, } from "react";
import { Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
    const {profile, setProfile} = useContext(tonalityContext)!;

  return (
    <SafeAreaView style={{flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#DDEEE0ff",}}>
       <View style={{ marginBottom: 20, alignItems: 'center', flex: 1 }}>
            <Image
                source={{ uri: profile?.images[0]?.url }}
                style={{ width: 200, height: 200, borderRadius: 100, borderColor: '#3E3E3Eff', borderWidth: 2 }}
            />
            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Welcome {profile?.display_name}</Text>
       </View>
       <View style={{ flex: 2, alignItems: 'center', justifyContent: 'center' }}>
       </View>
      <Text>Home Screen</Text>
    </SafeAreaView>
  );
}