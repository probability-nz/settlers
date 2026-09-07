import React from 'react';
import { Text } from '../svg.jsx';

function Card({ width, height, color, children }) {
  return (
    <>
      <rect width={width} height={height} fill={color} />
      {children}
    </>
  );
}

export function CardBack({ width, height, color, label, size, fill }) {
  return (
    <Card width={width} height={height} color={color}>
      <Text x={31.5} y={size === 5.8 ? 45.95 : 46.6} size={size} bold fill={fill}>
        {label}
      </Text>
    </Card>
  );
}

export function ResourceCard({ width, height, color, label, emoji }) {
  return (
    <Card width={width} height={height} color={color}>
      <Text x={31.5} y={34.4} size={8.2} bold>{label}</Text>
      <Text x={31.5} y={58.5} size={15} emoji>{emoji}</Text>
    </Card>
  );
}

export function DevelopmentCard({ width, height, title, text }) {
  return (
    <Card width={width} height={height} color="oldlace">
      <Text x={31.5} y={15.9} size={4.6} bold>{title}</Text>
      <Text x={31.5} y={34.1296875} size={3.8} lineHeight={7}>{text}</Text>
    </Card>
  );
}

export function AwardCard({ width, height, color, title, text }) {
  return (
    <Card width={width} height={height} color={color}>
      <Text x={44} y={58.3046875} size={7.8} bold>{title}</Text>
      <Text x={44} y={73.39375} size={5.4} bold>{text}</Text>
    </Card>
  );
}

export function BuildingCostsCard({ width, height, color, title, text }) {
  return (
    <Card width={width} height={height} color={color}>
      <Text x={44} y={24.6} size={8.6} lineHeight={8.6} bold>{title}</Text>
      <Text x={44} y={46.2} size={6.2} lineHeight={8.4} bold>{text}</Text>
    </Card>
  );
}

export function BusinessCard({ width, height, color, title, text }) {
  return (
    <Card width={width} height={height} color={color}>
      <Text x={5.8} y={12.8} size={5.8} bold align="start">{title}</Text>
      <Text x={5.8} y={19.6} size={3.6} lineHeight={4.5} align="start">{text}</Text>
    </Card>
  );
}

export function BusinessCardBack({ width, height, color, fill, text }) {
  return (
    <Card width={width} height={height} color={color}>
      <Text x={45} y={34.35} size={18.3} emoji fill={fill}>{text}</Text>
    </Card>
  );
}
