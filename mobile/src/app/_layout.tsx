import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Hele appen er portrett som standard; analyse-skjermen låser opp selv.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
