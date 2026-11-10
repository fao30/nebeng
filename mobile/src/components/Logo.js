import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Logo "N Rute": the letter N drawn as a route, ending at a teal destination. */
export default function Logo({ size = 40 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width="64" height="64" rx="16" fill="#155DFC" />
      <Path d="M19 45V19l26 26V18" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="19" cy="45" r="4.6" fill="#FFFFFF" />
      <Circle cx="45" cy="17.5" r="5.4" fill="#F9FF52" />
    </Svg>
  );
}
