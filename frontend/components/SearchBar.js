'use client';
import { useState } from 'react';
import Icon from './Icon';
import PointField from './PointField';
import { todayISO } from '@/lib/format';

export default function SearchBar({ initial = {}, onSearch, busy }) {
  const [from, setFrom] = useState(initial.from || null);
  const [to, setTo] = useState(initial.to || null);
  const [date, setDate] = useState(initial.date || '');
  const [seats, setSeats] = useState(initial.seats || 1);

  function submit(e) {
    e.preventDefault();
    onSearch({ from, to, date, seats });
  }

  return (
    <form className="searchbar" onSubmit={submit} role="search">
      <PointField label="Dari" placeholder="Berangkat dari" kind="origin" value={from} onChange={setFrom} compact />
      <PointField label="Ke" placeholder="Mau ke mana?" kind="dest" value={to} onChange={setTo} compact />
      <input className="input" type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} aria-label="Tanggal berangkat" />
      <select className="input" value={seats} onChange={(e) => setSeats(Number(e.target.value))} aria-label="Jumlah penumpang">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <option key={n} value={n}>
            {n} orang
          </option>
        ))}
      </select>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        <Icon name="search" />
        Cari
      </button>
    </form>
  );
}
