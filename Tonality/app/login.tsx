import { View } from 'react-native';

// Login is handled in index.tsx
export default function LoginPlaceholder() {
    return <View />;
}

// import { useState } from 'react';
// import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Ionicons } from '@expo/vector-icons';
// import { useRouter } from 'expo-router';
// import { useTonalityAuth } from '../hooks/useTonalityAuth';

// export default function LoginScreen() {
//     const router = useRouter();
//     const { login } = useTonalityAuth();
//     const [email, setEmail] = useState('');
//     const [password, setPassword] = useState('');
//     const [error, setError] = useState<string | null>(null);
//     const [submitting, setSubmitting] = useState(false);

//     const handleLogin = async () => {
//         setError(null);
//         try {
//             setSubmitting(true);
//             //await login(email.trim(), password);
//             router.replace('/(tabs)');
//         } catch (e: any) {
//             setError(e.message || 'Login failed');
//         } finally {
//             setSubmitting(false);
//         }
//     };

//     const isDisabled = !email || !password || submitting;

//     return (
//         <SafeAreaView style={styles.container}>
//             <KeyboardAvoidingView
//                 style={styles.inner}
//                 behavior={Platform.OS === 'ios' ? 'padding' : undefined}
//             >
//                 <View style={styles.header}>
//                     <Text style={styles.appName}>TONALITYEEEE</Text>
//                     <Text style={styles.tagline}>Sign in to your account</Text>
//                 </View>

//                 <View style={styles.card}>
//                     <Text style={styles.label}>Email</Text>
//                     <TextInput
//                         style={styles.input}
//                         autoCapitalize="none"
//                         keyboardType="email-address"
//                         value={email}
//                         onChangeText={setEmail}
//                         placeholder="you@example.com"
//                         placeholderTextColor="#9BA0A5"
//                     />

//                     <Text style={styles.label}>Password</Text>
//                     <TextInput
//                         style={styles.input}
//                         secureTextEntry
//                         value={password}
//                         onChangeText={setPassword}
//                         placeholder="••••••••"
//                         placeholderTextColor="#9BA0A5"
//                     />

//                     {error && <Text style={styles.errorText}>{error}</Text>}

//                     <Pressable
//                         style={[styles.primaryButton, isDisabled && styles.primaryButtonDisabled]}
//                         onPress={handleLogin}
//                         disabled={isDisabled}
//                     >
//                         <Ionicons name="log-in-outline" size={20} color="white" />
//                         <Text style={styles.primaryButtonText}>
//                             {submitting ? 'Signing in...' : 'Sign in'}
//                         </Text>
//                     </Pressable>

//                     <Text style={styles.helperText}>
//                         This is a prototype. Any email/password will create a mock Tonality account on
//                         this device.
//                     </Text>
//                 </View>
//             </KeyboardAvoidingView>
//         </SafeAreaView>
//     );
// }

// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         backgroundColor: '#DDEEE0',
//     },
//     inner: {
//         flex: 1,
//         padding: 20,
//         justifyContent: 'center',
//     },
//     header: {
//         marginBottom: 30,
//         alignItems: 'center',
//     },
//     appName: {
//         fontSize: 32,
//         fontWeight: 'bold',
//         color: '#3E3E3E',
//     },
//     tagline: {
//         marginTop: 6,
//         fontSize: 14,
//         color: '#6B6B6B',
//     },
//     card: {
//         backgroundColor: 'white',
//         borderRadius: 16,
//         padding: 20,
//         shadowColor: '#000',
//         shadowOffset: { width: 0, height: 4 },
//         shadowOpacity: 0.1,
//         shadowRadius: 8,
//         elevation: 4,
//     },
//     label: {
//         fontSize: 14,
//         color: '#3E3E3E',
//         marginBottom: 6,
//         marginTop: 10,
//     },
//     input: {
//         borderWidth: 1,
//         borderColor: '#C5D0C8',
//         borderRadius: 10,
//         paddingHorizontal: 12,
//         paddingVertical: 10,
//         fontSize: 14,
//         color: '#2B2B2B',
//     },
//     primaryButton: {
//         marginTop: 20,
//         backgroundColor: '#1DB954',
//         flexDirection: 'row',
//         alignItems: 'center',
//         justifyContent: 'center',
//         paddingVertical: 12,
//         borderRadius: 24,
//         gap: 8,
//     },
//     primaryButtonDisabled: {
//         opacity: 0.6,
//     },
//     primaryButtonText: {
//         color: 'white',
//         fontSize: 16,
//         fontWeight: '600',
//     },
//     errorText: {
//         marginTop: 8,
//         color: '#D9534F',
//         fontSize: 13,
//     },
//     helperText: {
//         marginTop: 12,
//         fontSize: 12,
//         color: '#6B6B6B',
//     },
// });
