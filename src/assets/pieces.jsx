import React from 'react';
import { Text } from '../svg.jsx';

function Hexagon({ color, children, radius = 45 }) {
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = index * Math.PI / 3 - Math.PI / 2;
    const x = radius + radius * Math.cos(angle);
    const y = radius + radius * Math.sin(angle);
    return `${Number(x.toFixed(4))},${Number(y.toFixed(4))}`;
  }).join(' ');

  return (
    <>
      <polygon points={points} fill={color} />
      {children}
    </>
  );
}

export function ResourceTile({ color, emoji, label }) {
  return (
    <Hexagon color={color}>
      {emoji && <Text x={45} y={24.8} size={17} emoji>{emoji}</Text>}
      <Text x={45} y={73.5} size={9.2} bold>{label}</Text>
    </Hexagon>
  );
}

export function Harbor({ color, fill, title, text }) {
  return (
    <Hexagon color={color}>
      <Text x={45} y={36.2109375} size={8.6} bold fill={fill}>{title}</Text>
      <Text x={45} y={51.7109375} size={6.6} lineHeight={7.5890625} bold fill={fill}>
        {text}
      </Text>
    </Hexagon>
  );
}

export function CounterBack() {
  return <circle cx="12.5" cy="12.5" r="12.2" fill="linen" />;
}

export function Counter({ value }) {
  const fill = value === 6 || value === 8 ? 'firebrick' : 'black';
  // Two six-sided dice have 6 - |7 - total| combinations for each total.
  const dots = 6 - Math.abs(7 - value);

  return (
    <>
      <CounterBack />
      <Text x={12.5} y={14.7824} size={8.8} bold fill={fill}>{value}</Text>
      <Text x={12.5} y={17.7424} size={3.8} bold fill={fill} letterSpacing={0.2}>
        {'•'.repeat(dots)}
      </Text>
    </>
  );
}

export function Road({ color }) {
  return <polygon points="0,0 25,0 25,4 0,4" fill={color} />;
}

export function House({ color }) {
  return <polygon points="0,12 0,5 7,0 14,5 14,12" fill={color} />;
}

export function City({ color }) {
  return <polygon points="0,17 0,2.5 1,0 6,0 7,2.5 7,9 16,9 16,17" fill={color} />;
}

export function Robber() {
  return (
    <polygon
      points="0,36 0,32.5 2.5,30.5 4.5,2 6.5,0 11.5,0 13.5,2 15.5,30.5 18,32.5 18,36"
      fill="#363636"
    />
  );
}
