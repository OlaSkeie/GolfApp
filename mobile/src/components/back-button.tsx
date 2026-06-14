import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Arc } from '@/constants/theme';

// Rund tilbake-knapp i ARC-stil. Bruk øverst på skjermer med egendefinert header.
export function BackButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
      <View style={styles.icon}>
        <Icon name="chevron" size={20} color={Arc.color.ink} stroke={2.4} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { marginTop: 8, marginBottom: 4 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Arc.radius.pill,
    backgroundColor: Arc.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }], // chevron peker venstre
    ...Arc.shadow.sm,
  },
  pressed: { opacity: 0.7 },
});
