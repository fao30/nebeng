import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, Text, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from './src/Icon';
import { colors } from './src/theme';
import { api } from './src/api';
import { TERMS_VERSION } from './src/config';
import { AppProvider, identityOK, useApp } from './src/state';
import { TermsModal } from './src/components/Terms';
import Toast from './src/components/Toast';
import KycNotice from './src/components/KycNotice';
import Auth from './src/screens/Auth';
import Search from './src/screens/Search';
import Bookings from './src/screens/Bookings';
import Notifications, { openNotification } from './src/screens/Notifications';
import Profile from './src/screens/Profile';
import Trip from './src/screens/Trip';
import Chat from './src/screens/Chat';
import Verify from './src/screens/Verify';
import DriverTrips from './src/screens/DriverTrips';
import NewTrip from './src/screens/NewTrip';
import TermsScreen from './src/screens/Terms';
import { Screen } from './src/ui';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const nav = createNavigationContainerRef();

const header = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { fontWeight: '800', color: colors.ink },
  headerTintColor: colors.primary,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.canvas },
};

/** Driver pages stay locked until identity and car are verified. */
function VehicleGate({ children, navigation }) {
  const { user } = useApp();
  if (identityOK(user) && user.vehicle_status === 'approved') return children;
  return (
    <Screen>
      <KycNotice need="vehicle" navigation={navigation} />
    </Screen>
  );
}
// Passenger tabs show the verification bar on top until identity is approved.
const withBar = (C) => {
  const Wrapped = (p) => (
    <View style={{ flex: 1 }}>
      <KycBar />
      <C {...p} />
    </View>
  );
  return Wrapped;
};
const SearchTab = withBar(Search);
const BookingsTab = withBar(Bookings);

const GatedDriverTrips = (p) => (
  <VehicleGate {...p}>
    <DriverTrips {...p} />
  </VehicleGate>
);
const GatedNewTrip = (p) => (
  <VehicleGate {...p}>
    <NewTrip {...p} />
  </VehicleGate>
);

function KycBar() {
  const { user } = useApp();
  if (!user || identityOK(user)) return null;
  const pending = user.identity_status === 'pending';
  return (
    <Pressable onPress={() => nav.isReady() && nav.navigate('Verifikasi')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pending ? colors.amber50 : colors.primary }}>
      <Icon name={pending ? 'clock' : 'shield'} size={16} color={pending ? colors.amber : '#fff'} />
      <Text style={{ flex: 1, color: pending ? colors.amber : '#fff', fontWeight: '700', fontSize: 13.5 }}>
        {pending
          ? 'Verifikasi sedang ditinjau admin, maksimal 1x24 jam.'
          : user.identity_status === 'rejected'
            ? 'Verifikasi ditolak. Ketuk untuk kirim ulang.'
            : 'Verifikasi wajah dan KTP/SIM untuk mulai nebeng.'}
      </Text>
      <Icon name="chevronRight" size={16} color={pending ? colors.amber : '#fff'} />
    </Pressable>
  );
}

function Tabs() {
  const { mode, notifs } = useApp();
  const icon = (name) => ({ color, size }) => <Icon name={name} size={size - 2} color={color} />;
  const opts = { ...header, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontWeight: '700', fontSize: 11 } };
  const notifTab = <Tab.Screen name="Notifikasi" component={Notifications} options={{ tabBarIcon: icon('bell'), tabBarBadge: notifs.unread ? (notifs.unread > 99 ? '99+' : notifs.unread) : undefined }} />;
  const profileTab = <Tab.Screen name="Profil" component={Profile} options={{ tabBarIcon: icon('user') }} />;
  return mode === 'driver' ? (
    <Tab.Navigator key="driver" screenOptions={opts}>
      <Tab.Screen name="Trip saya" component={GatedDriverTrips} options={{ tabBarIcon: icon('car') }} />
      <Tab.Screen name="Buat trip" component={GatedNewTrip} options={{ tabBarIcon: icon('plus') }} />
      {notifTab}
      {profileTab}
    </Tab.Navigator>
  ) : (
    <Tab.Navigator key="passenger" screenOptions={opts}>
      <Tab.Screen name="Cari" component={SearchTab} options={{ tabBarIcon: icon('search'), title: 'Cari tumpangan', tabBarLabel: 'Cari' }} />
      <Tab.Screen name="Perjalanan" component={BookingsTab} options={{ tabBarIcon: icon('ticket') }} />
      {notifTab}
      {profileTab}
    </Tab.Navigator>
  );
}

function Root() {
  const { user, ready, setUser, signOut } = useApp();
  const [termsBusy, setTermsBusy] = useState(false);
  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  return (
    <>
      <NavigationContainer ref={nav}>
        <Stack.Navigator screenOptions={header}>
          {!user ? (
            <Stack.Screen name="Masuk" component={Auth} options={{ headerShown: false }} />
          ) : (
            <>
              <Stack.Screen name="Home" component={Tabs} options={{ headerShown: false }} />
              <Stack.Screen name="Trip" component={Trip} options={{ title: 'Trip' }} />
              <Stack.Screen name="Chat" component={Chat} />
              <Stack.Screen name="Verifikasi" component={Verify} options={{ title: 'Verifikasi akun' }} />
              <Stack.Screen name="Syarat" component={TermsScreen} options={{ title: 'Syarat & Ketentuan' }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      {user && <Toast onOpen={(n) => nav.isReady() && openNotification(n, nav)} />}
      {/* Existing accounts accept new or updated terms before continuing. */}
      <TermsModal
        open={!!user && user.terms_version !== TERMS_VERSION}
        busy={termsBusy}
        acceptLabel="Setuju"
        onDecline={signOut}
        onAccept={async () => {
          setTermsBusy(true);
          try {
            setUser(await api('/me/terms', { method: 'POST', body: { version: TERMS_VERSION } }));
          } finally {
            setTermsBusy(false);
          }
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
