import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");
const outputManifestPath = join(distDir, "probability.json");
const outputPackagePath = join(distDir, "package.json");
const SCHEMA_URL = "https://registry.probabilityusercontent.nz/npm/@probability-nz/types/-/types-0.0.0.tgz/dist/analog.json";

const position = (x, z) => [x, null, z];
const matHalfWidth = 0.841 / 2;
const tokenSideGap = 0.055;
const leftTokenX = Number(-(matHalfWidth + tokenSideGap).toFixed(4));
const rightTokenX = Number((matHalfWidth + tokenSideGap).toFixed(4));
const rotatedLog = [0, 90, 0];
const woodenTypeGap = 0.02;
const woodenColorGap = 0.03;
const woodenStackSpacing = 0.02;
const roadPileDepth = 0.025;
const cityPileDepth = 0.03;
const housePileDepth = 0.05;
const cityPileZOffset = roadPileDepth / 2 + woodenTypeGap + cityPileDepth / 2;
const housePileZOffset = cityPileZOffset + cityPileDepth / 2 + woodenTypeGap + housePileDepth / 2;
const woodenSupplyDepth = roadPileDepth / 2 + housePileZOffset + housePileDepth / 2;
const upperTokenZ = -0.12;
const lowerTokenZ = Number((upperTokenZ + woodenSupplyDepth + woodenColorGap).toFixed(4));
const rulerLength = 0.205;
const rulerArmWidth = 0.03;
const rulerX = Number((leftTokenX + rulerLength / 2 - rulerArmWidth / 2).toFixed(4));
const rulerZ = Number((upperTokenZ - roadPileDepth / 2 - woodenColorGap - rulerLength / 2).toFixed(4));
const cardColumnGap = 0.11;
const smallCardHeight = 0.088;
const bigCardHeight = 0.126;
const cardEdgeGap = cardColumnGap - smallCardHeight;
const leftCardX = -0.35;
const resourceCardX = 0.34;
const businessCardX = 0.19;
const playerTints = {
  red: "indianred",
  blue: "cornflowerblue",
  white: "white",
  orange: "orange",
};

const stackChildren = ({ template, name, level = 2, count, tint, rotation }) => {
  if (level > count) return undefined;
  return [{
    template,
    name: `${name}-${level}`,
    position: position(0, 0),
    tint,
    rotation,
    children: stackChildren({ template, name, level: level + 1, count, tint, rotation }),
  }];
};

const stack = ({ template, name, count, x, z, tint, rotation }) => ({
  template,
  name: `${name}-1`,
  position: position(x, z),
  tint,
  rotation,
  children: stackChildren({ template, name, count, tint, rotation }),
});

const mixedStackChildren = (cards, index = 1) => {
  if (index >= cards.length) return undefined;
  const parent = cards[index - 1];
  const card = cards[index];
  return [{
    template: card.template,
    name: `${card.name}-${card.count}`,
    position: position(0, 0),
    children: mixedStackChildren(cards, index + 1),
  }];
};

const mixedStack = ({ cards, x, z }) => {
  const [first] = cards;
  return {
    template: first.template,
    name: `${first.name}-${first.count}`,
    position: position(x, z),
    children: mixedStackChildren(cards),
  };
};

const repeatedCards = (template, name, count) =>
  Array.from({ length: count }, (_, index) => ({ template, name, count: index + 1 }));

const stackedCenters = (heights, gap) => {
  const totalHeight = heights.reduce((sum, height) => sum + height, 0) + gap * (heights.length - 1);
  let edge = -totalHeight / 2;
  return heights.map((height) => {
    const center = edge + height / 2;
    edge += height + gap;
    return Number(center.toFixed(4));
  });
};

const row = ({ template, name, count, x, z, spacing, tint = "red" }) =>
  Array.from({ length: count }, (_, index) => ({
    template,
    name: `${name} ${index + 1}`,
    position: position(x, Number((z + index * spacing).toFixed(4))),
    tint,
  }));

const logStack = ({ label, x, z, columns = 3, height = 5, spacing = 0.0065, tint }) =>
  Array.from({ length: columns }, (_, index) => ({
    template: "road",
    name: `${label} ROAD ${index + 1}-1`,
    position: position(Number((x + (index - (columns - 1) / 2) * spacing).toFixed(4)), z),
    tint,
    rotation: rotatedLog,
    children: stackChildren({ template: "road", name: `${label} ROAD ${index + 1}`, count: height, tint, rotation: rotatedLog }),
  }));

const pieceStacks = ({ template, label, kind, x, z, stacks, spacing = woodenStackSpacing, tint }) =>
  stacks.map((height, index) => ({
    template,
    name: `${label} ${kind} ${index + 1}-1`,
    position: position(x, Number((z + (index - (stacks.length - 1) / 2) * spacing).toFixed(4))),
    tint,
    children: stackChildren({ template, name: `${label} ${kind} ${index + 1}`, count: height, tint }),
  }));

const woodenSupply = ({ label, tint, x, z }) => [
  ...logStack({ label, tint, x, z }),
  ...pieceStacks({ template: "settlement", label, kind: "CITY", x, z: z + cityPileZOffset, stacks: [2, 2], tint }),
  ...pieceStacks({ template: "house", label, kind: "HOUSE", x, z: z + housePileZOffset, stacks: [2, 2, 1], tint }),
];

const templates = {
  ocean: { name: "OCEAN BOARD", src: "models/ocean.gltf", locked: true },
  tileBrick: { name: "BRICK TILE", src: "models/tile-brick.gltf", locked: true },
  tileDesert: { name: "DESERT TILE", src: "models/tile-desert.gltf", locked: true },
  tileCorn: { name: "CORN TILE", src: "models/tile-corn.gltf", locked: true },
  tileTimber: { name: "TIMBER TILE", src: "models/tile-timber.gltf", locked: true },
  tileOre: { name: "ORE TILE", src: "models/tile-ore.gltf", locked: true },
  tileWool: { name: "WOOL TILE", src: "models/tile-wool.gltf", locked: true },
  harbor31: { name: "3:1 HARBOR", src: "models/harbor-3-1.gltf", locked: true },
  harborBrick: { name: "BRICK 2:1 HARBOR", src: "models/harbor-brick.gltf", locked: true },
  harborCorn: { name: "CORN 2:1 HARBOR", src: "models/harbor-corn.gltf", locked: true },
  harborTimber: { name: "TIMBER 2:1 HARBOR", src: "models/harbor-timber.gltf", locked: true },
  harborOre: { name: "ORE 2:1 HARBOR", src: "models/harbor-ore.gltf", locked: true },
  harborWool: { name: "WOOL 2:1 HARBOR", src: "models/harbor-wool.gltf", locked: true },
  robber: { name: "ROBBER", src: "models/robber.gltf" },
  road: { name: "ROAD", src: "models/road.gltf" },
  settlement: { name: "CITY", src: "models/settlement.gltf" },
  house: { name: "HOUSE", src: "models/house.gltf" },
  ruler: { name: "L-SHAPED RULER", src: "models/ruler.gltf" },
  ...Object.fromEntries([2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((value) => [
    `counter${value}`,
    { name: `${value} COUNTER`, src: `models/counter-${value}.gltf`, locked: true },
  ])),
  resourceCardBrick: { name: "BRICK RESOURCE CARD", src: "models/resource-card-brick.gltf" },
  resourceCardCorn: { name: "CORN RESOURCE CARD", src: "models/resource-card-corn.gltf" },
  resourceCardTimber: { name: "TIMBER RESOURCE CARD", src: "models/resource-card-timber.gltf" },
  resourceCardOre: { name: "ORE RESOURCE CARD", src: "models/resource-card-ore.gltf" },
  resourceCardWool: { name: "WOOL RESOURCE CARD", src: "models/resource-card-wool.gltf" },
  knightCard: { name: "KNIGHT CARD", src: "models/knight-card.gltf" },
  roadBuildingCard: { name: "ROAD BUILDING CARD", src: "models/road-building-card.gltf" },
  yearOfPlentyCard: { name: "YEAR OF PLENTY CARD", src: "models/year-of-plenty-card.gltf" },
  monopolyCard: { name: "MONOPOLY CARD", src: "models/monopoly-card.gltf" },
  chapelCard: { name: "CHAPEL CARD", src: "models/chapel-card.gltf" },
  greatHallCard: { name: "GREAT HALL CARD", src: "models/great-hall-card.gltf" },
  libraryCard: { name: "LIBRARY CARD", src: "models/library-card.gltf" },
  marketCard: { name: "MARKET CARD", src: "models/market-card.gltf" },
  universityCard: { name: "UNIVERSITY CARD", src: "models/university-card.gltf" },
  largestArmyCard: { name: "LARGEST ARMY CARD", src: "models/largest-army-card.gltf" },
  longestRoadCard: { name: "LONGEST ROAD CARD", src: "models/longest-road-card.gltf" },
  buildingCostCard: { name: "BUILDING COST CARD", src: "models/building-cost-card.gltf" },
  businessCard: { name: "BUSINESS CARD", src: "models/business-card.gltf" },
};

const tileTemplate = (resource) => `tile${resource}`;
const hexXStep = 0.082;
const hexZStep = 0.071;
const hex = (q, r) => [
  Number((hexXStep * (q + r / 2)).toFixed(4)),
  Number((hexZStep * r).toFixed(4)),
];

const axialRing = (radius) => {
  const directions = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ];
  const result = [];
  let q = 0;
  let r = -radius;
  for (const [dq, dr] of directions) {
    for (let index = 0; index < radius; index += 1) {
      result.push([q, r]);
      q += dq;
      r += dr;
    }
  }
  return result;
};

const trackedRingSlots = (radius) => {
  const ring = axialRing(radius);
  const used = new Set();
  return (slot) => {
    if (slot < 0 || slot >= ring.length) throw new Error(`Invalid harbor slot ${slot}`);
    if (used.has(slot)) throw new Error(`Duplicate harbor slot ${slot}`);
    used.add(slot);
    return ring[slot];
  };
};

const boardTiles = [
  ["Ore", 5, 0, -2],
  ["Corn", 2, 1, -2],
  ["Timber", 6, 2, -2],
  ["Wool", 3, -1, -1],
  ["Brick", 8, 0, -1],
  ["Ore", 10, 1, -1],
  ["Corn", 9, 2, -1],
  ["Timber", 11, -2, 0],
  ["Wool", 4, -1, 0],
  ["Desert", null, 0, 0],
  ["Brick", 3, 1, 0],
  ["Ore", 8, 2, 0],
  ["Corn", 4, -2, 1],
  ["Timber", 10, -1, 1],
  ["Wool", 9, 0, 1],
  ["Brick", 12, 1, 1],
  ["Wool", 6, -2, 2],
  ["Corn", 5, -1, 2],
  ["Timber", 11, 0, 2],
];

const harborHex = trackedRingSlots(3);

const harbors = [
  ["harbor31", "Generic harbor 1", 0],
  ["harborBrick", "Brick harbor", 2],
  ["harbor31", "Generic harbor 2", 4],
  ["harborTimber", "Timber harbor", 6],
  ["harborWool", "Wool harbor", 8],
  ["harborOre", "Ore harbor", 10],
  ["harbor31", "Generic harbor 3", 12],
  ["harborCorn", "Corn harbor", 14],
  ["harbor31", "Generic harbor 4", 16],
].map(([template, name, slot]) => {
  const [q, r] = harborHex(slot);
  const [x, z] = hex(q, r);
  return { template, name, position: position(x, z) };
});

const tilePiece = ([resource, counter, q, r]) => {
  const [x, z] = hex(q, r);
  const displayResource = resource.toUpperCase();
  const piece = {
    template: tileTemplate(resource),
    name: counter === null ? "DESERT" : `${displayResource} ${counter}`,
    position: position(x, z),
    children: [],
  };
  if (counter === null) {
    piece.children.push({ template: "robber", name: "ROBBER", position: position(0, 0) });
  } else {
    piece.children.push({
      template: `counter${counter}`,
      name: `${displayResource} ${counter} COUNTER`,
      position: position(0, 0),
    });
  }
  return piece;
};

const cardStacks = [
  ["resourceCardBrick", "BRICK RESOURCE CARD", 19, -2 * cardColumnGap],
  ["resourceCardTimber", "TIMBER RESOURCE CARD", 19, -cardColumnGap],
  ["resourceCardWool", "WOOL RESOURCE CARD", 19, 0],
  ["resourceCardCorn", "CORN RESOURCE CARD", 19, cardColumnGap],
  ["resourceCardOre", "ORE RESOURCE CARD", 19, 2 * cardColumnGap],
].map(([template, name, count, z]) => stack({ template, name, count, x: resourceCardX, z, rotation: [180, 0, 0] }));

const [
  largestArmyCardZ,
  longestRoadCardZ,
  buildingCostCardZ,
  actionCardStackZ,
] = stackedCenters([bigCardHeight, bigCardHeight, bigCardHeight, smallCardHeight], cardEdgeGap);

const actionCardStack = mixedStack({
  x: leftCardX,
  z: actionCardStackZ,
  cards: [
    ...repeatedCards("knightCard", "KNIGHT CARD", 14),
    ...repeatedCards("roadBuildingCard", "ROAD BUILDING CARD", 2),
    ...repeatedCards("yearOfPlentyCard", "YEAR OF PLENTY CARD", 2),
    ...repeatedCards("monopolyCard", "MONOPOLY CARD", 2),
    { template: "chapelCard", name: "CHAPEL CARD", count: 1 },
    { template: "greatHallCard", name: "GREAT HALL CARD", count: 1 },
    { template: "libraryCard", name: "LIBRARY CARD", count: 1 },
    { template: "marketCard", name: "MARKET CARD", count: 1 },
    { template: "universityCard", name: "UNIVERSITY CARD", count: 1 },
  ],
});

const awardCards = [
  ["largestArmyCard", "LARGEST ARMY CARD", largestArmyCardZ, [180, 0, 0]],
  ["longestRoadCard", "LONGEST ROAD CARD", longestRoadCardZ, [180, 0, 0]],
  ["buildingCostCard", "BUILDING COST CARD", buildingCostCardZ, [180, 0, 0]],
].map(([template, name, z, rotation]) => stack({ template, name, count: 1, x: leftCardX, z, rotation }));

const matPieces = [
  ...boardTiles.map(tilePiece),
  ...harbors,
  ...cardStacks,
  actionCardStack,
  ...awardCards,
  { template: "businessCard", name: "BUSINESS CARD-1", position: position(businessCardX, 0.255) },
];

const sidePieces = [
  { template: "ruler", name: "L-SHAPED RULER", position: position(rulerX, rulerZ) },
  ...woodenSupply({ label: "RED", tint: playerTints.red, x: rightTokenX, z: upperTokenZ }),
  ...woodenSupply({ label: "BLUE", tint: playerTints.blue, x: rightTokenX, z: lowerTokenZ }),
  ...woodenSupply({ label: "WHITE", tint: playerTints.white, x: leftTokenX, z: upperTokenZ }),
  ...woodenSupply({ label: "ORANGE", tint: playerTints.orange, x: leftTokenX, z: lowerTokenZ }),
];

const manifest = {
  $schema: SCHEMA_URL,
  templates,
  scenarios: [{
    name: "PREMADE SETTLERS BOARD",
    children: [
      {
        template: "ocean",
        name: "OCEAN",
        position: position(0, 0),
        children: matPieces,
      },
      ...sidePieces,
    ],
  }],
};

await mkdir(distDir, { recursive: true });
await writeFile(outputManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(outputPackagePath, `${JSON.stringify({
  name: "settlers-probability-example",
  version: "0.0.0",
  private: true,
  main: "probability.json",
}, null, 2)}\n`);
console.log("Generated dist package");
