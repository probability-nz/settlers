import React from 'react';
import { Svg } from './svg.jsx';
import * as cards from './assets/cards.jsx';
import * as pieces from './assets/pieces.jsx';
import * as tools from './assets/tools.jsx';

// Each template owns its component, physical dimensions (mm), and CSV fields.
export const templates = {
  back: { Component: cards.CardBack, dimensions: [63, 88], required: ['label', 'color', 'size'] },
  resource: { Component: cards.ResourceCard, dimensions: [63, 88], required: ['label', 'color', 'emoji'] },
  development: { Component: cards.DevelopmentCard, dimensions: [63, 88], required: ['title', 'text'] },
  award: { Component: cards.AwardCard, dimensions: [88, 126], required: ['title', 'text', 'color'] },
  costs: { Component: cards.BuildingCostsCard, dimensions: [88, 126], required: ['title', 'text', 'color'] },
  business: { Component: cards.BusinessCard, dimensions: [90, 55], required: ['title', 'text', 'color'] },
  'business-back': { Component: cards.BusinessCardBack, dimensions: [90, 55], required: ['text', 'color'] },
  tile: { Component: pieces.ResourceTile, dimensions: [90, 90], required: ['label', 'color'] },
  harbor: { Component: pieces.Harbor, dimensions: [90, 90], required: ['title', 'text', 'color'] },
  counter: { Component: pieces.Counter, dimensions: [25, 25], required: ['value'] },
  'counter-back': { Component: pieces.CounterBack, dimensions: [25, 25] },
  road: { Component: pieces.Road, dimensions: [25, 4], required: ['color'] },
  house: { Component: pieces.House, dimensions: [14, 12], required: ['color'] },
  city: { Component: pieces.City, dimensions: [16, 17], required: ['color'] },
  robber: { Component: pieces.Robber, dimensions: [18, 36] },
  'cutting-mat': { Component: tools.CuttingMat, dimensions: [841, 594] },
  ruler: { Component: tools.Ruler, dimensions: [205, 205] },
};

export function Asset({ asset }) {
  if (!Object.hasOwn(templates, asset.kind)) {
    throw new Error(`Unknown asset kind: ${asset.kind}`);
  }
  const { Component } = templates[asset.kind];

  return (
    <Svg
      width={asset.width}
      height={asset.height}
      title={asset.name.replaceAll('_', ' ').replaceAll('-', ' ')}
    >
      <Component {...asset} />
    </Svg>
  );
}
