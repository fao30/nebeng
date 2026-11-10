// MapTiler Cloud — map tiles and geocoding (search). https://docs.maptiler.com
// Set NEXT_PUBLIC_MAPTILER_KEY (and restrict it to your domain in the
// MapTiler dashboard). Optional NEXT_PUBLIC_MAPTILER_STYLE (default streets-v4).

export const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';
const STYLE = process.env.NEXT_PUBLIC_MAPTILER_STYLE || 'streets-v4';

export const maptilerEnabled = () => !!MAPTILER_KEY;

export function maptilerTiles() {
  return {
    url: `https://api.maptiler.com/maps/${STYLE}/256/{z}/{x}/{y}.png?key=${encodeURIComponent(MAPTILER_KEY)}`,
    options: {
      minZoom: 1,
      maxZoom: 19,
      crossOrigin: true,
      attribution:
        '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&copy; OpenStreetMap</a>',
    },
  };
}

const base = 'https://api.maptiler.com/geocoding';

/** Forward search, biased to Indonesia and (optionally) a nearby point. */
export async function maptilerSearch(query, { signal, near } = {}) {
  const params = new URLSearchParams({ key: MAPTILER_KEY, country: 'id', language: 'id', limit: '6', autocomplete: 'true' });
  if (near) params.set('proximity', `${near.lng},${near.lat}`);
  const res = await fetch(`${base}/${encodeURIComponent(query)}.json?${params}`, { signal });
  if (!res.ok) throw new Error(`MapTiler ${res.status}`);
  const data = await res.json();
  return (data.features || [])
    .filter((f) => Array.isArray(f.center))
    .map((f) => ({ lng: f.center[0], lat: f.center[1], label: shorten(f.place_name || f.text) }));
}

export async function maptilerReverse(lat, lng) {
  const params = new URLSearchParams({ key: MAPTILER_KEY, language: 'id' });
  const res = await fetch(`${base}/${lng},${lat}.json?${params}`);
  if (!res.ok) throw new Error(`MapTiler ${res.status}`);
  const data = await res.json();
  const f = data.features?.[0];
  if (!f) throw new Error('alamat tidak ditemukan');
  return shorten(f.place_name || f.text);
}

// "Stasiun Tambun, Jalan X, Tambun Selatan, Bekasi, Jawa Barat, Indonesia" -> first 3 parts
function shorten(name = '') {
  return name
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'Indonesia')
    .slice(0, 3)
    .join(', ');
}
