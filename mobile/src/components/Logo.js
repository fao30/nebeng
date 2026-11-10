import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export default function Logo({ size = 40 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5B39C9" />
          <Stop offset="1" stopColor="#3B2093" />
        </LinearGradient>
      </Defs>
      <Rect width="64" height="64" rx="16" fill="url(#g)" />
      <Path d="M20 44c0-12 24-12 24-24" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
      <Circle cx="20" cy="44" r="6" fill="#fff" />
      <Circle cx="44" cy="20" r="6" fill="#fff" />
    </Svg>
  );
}
