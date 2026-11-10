import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Icon from '../Icon';
import { colors, t } from '../theme';
import { fmtDate, fmtDay } from '../format';
import { Button, Sheet, s } from '../ui';

/** Date (or date + time) picker: native dialog on Android, sheet on iOS. */
export default function DateTimeField({ label, value, onChange, mode = 'date', placeholder = 'Kapan saja', clearable, minimumDate = new Date() }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || new Date());

  function openPicker() {
    const v = value || new Date(Date.now() + 2 * 3600e3);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: v,
        mode: 'date',
        minimumDate,
        onChange: (e, d) => {
          if (e.type !== 'set' || !d) return;
          if (mode === 'date') return onChange(d);
          DateTimePickerAndroid.open({
            value: d,
            mode: 'time',
            is24Hour: true,
            onChange: (e2, d2) => e2.type === 'set' && d2 && onChange(d2),
          });
        },
      });
    } else {
      setDraft(v);
      setOpen(true);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <Pressable onPress={openPicker} style={[s.input, { flexDirection: 'row', alignItems: 'center', gap: 10 }]} accessibilityLabel={label || 'Tanggal'}>
        <Icon name="calendar" size={18} color={colors.ink2} />
        <Text style={[t.body, { flex: 1 }, !value && { color: colors.muted }]}>{value ? (mode === 'date' ? fmtDay(value) : fmtDate(value)) : placeholder}</Text>
        {clearable && value && (
          <Pressable onPress={() => onChange(null)} hitSlop={10}>
            <Icon name="x" size={16} color={colors.muted} />
          </Pressable>
        )}
      </Pressable>
      {Platform.OS === 'ios' && (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title={label || 'Pilih tanggal'}
          footer={
            <Button
              title="Pilih"
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
            />
          }
        >
          <DateTimePicker value={draft} mode={mode} display={mode === 'date' ? 'inline' : 'spinner'} locale="id-ID" minimumDate={minimumDate} onChange={(e, d) => d && setDraft(d)} />
        </Sheet>
      )}
    </View>
  );
}
