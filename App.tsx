import React from "react";
import { View } from "react-native";
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './src/store/store';
import { ThemeProvider } from "./src/providers/ThemeProvider";
import { LanguageProvider } from "./src/providers/LanguageProvider";
import RootNavigator from "./src/navigation/RootNavigator";
import useFonts from "./src/utils/Fonts";
import { ToastProvider } from "./src/components/ui/Toast";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const fontsLoaded = useFonts();

  React.useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return <View style={{ flex: 1 }} />;

  return <RootNavigator />;
}

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SafeAreaProvider>
          <ThemeProvider>
            <LanguageProvider>
              <ToastProvider>
                <AppContent />
              </ToastProvider>
            </LanguageProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
}