import React from 'react';
import { Text, View } from 'react-native';
import Icon from '../Icon';
import { colors, t } from '../theme';
import { Button } from '../ui';
import { identityOK, useApp } from '../state';

/** Explains which verification is missing and links to the Verifikasi screen. */
export default function KycNotice({ need = 'identity', navigation }) {
  const { user } = useApp();
  const st = need === 'vehicle' && identityOK(user) ? user?.vehicle_status || '' : user?.identity_status || '';
  const pending = st === 'pending';
  const rejected = st === 'rejected';
  const title =
    need === 'vehicle' && identityOK(user)
      ? pending
        ? 'Data mobil Anda sedang ditinjau'
        : rejected
          ? 'Verifikasi mobil ditolak'
          : 'Aktifkan fitur pemilik mobil'
      : pending
        ? 'Identitas Anda sedang ditinjau'
        : rejected
          ? 'Verifikasi identitas ditolak'
          : 'Verifikasi identitas dulu';
  const body = pending
    ? 'Tim Numpang memeriksa data Anda, maksimal 1x24 jam. Kami kirim notifikasi begitu selesai.'
    : rejected
      ? 'Lihat alasannya dan kirim ulang foto di halaman verifikasi.'
      : need === 'vehicle'
        ? 'Untuk keamanan penumpang, pemilik mobil wajib verifikasi wajah, KTP/SIM, foto mobil tampak depan, dan STNK. Diperiksa admin maksimal 1x24 jam.'
        : 'Untuk keamanan bersama, setiap akun wajib verifikasi wajah dan KTP/SIM sebelum numpang. Diperiksa admin maksimal 1x24 jam.';
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: 18, backgroundColor: pending ? colors.amber50 : colors.primary50 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: pending ? colors.amber : colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={pending ? 'clock' : 'shield'} color="#fff" />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[t.body, t.strong]}>{title}</Text>
        <Text style={t.small}>{body}</Text>
        <Button small block={false} kind={pending ? 'soft' : 'primary'} title={pending ? 'Lihat status' : rejected ? 'Kirim ulang' : 'Mulai verifikasi'} onPress={() => navigation.navigate('Verifikasi')} />
      </View>
    </View>
  );
}
