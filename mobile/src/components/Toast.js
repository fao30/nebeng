import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../Icon';
import { colors, shadow, t } from '../theme';
import { useApp } from '../state';
import { notifIcon } from '../screens/Notifications';

/** Shows each incoming notification for a few seconds at the top of the screen. */
export default function Toast({ onOpen }) {
  const { toast, setToast } = useApp();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-200)).current;
  useEffect(() => {
    if (!toast) return;
    Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
    const id = setTimeout(() => Animated.timing(y, { toValue: -200, duration: 250, useNativeDriver: true }).start(() => setToast(null)), 5000);
    return () => clearTimeout(id);
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!toast) return null;
  const m = notifIcon(toast.type);
  return (
    <Animated.View style={{ position: 'absolute', left: 12, right: 12, top: insets.top + 8, transform: [{ translateY: y }], zIndex: 100 }}>
      <Pressable
        onPress={() => {
          setToast(null);
          onOpen(toast);
        }}
        style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, ...shadow }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: m.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={m.icon} size={17} color={m.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[t.body, t.strong]} numberOfLines={2}>
            {toast.title}
          </Text>
          {toast.body ? (
            <Text style={t.xs} numberOfLines={2}>
              {toast.body}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
