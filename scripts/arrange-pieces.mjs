import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_URL } from "@probability-nz/types";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");
const outputManifestPath = join(distDir, "probability.json");
const outputPackagePath = join(distDir, "package.json");

const halfYByTemplate = new Map([
  ["ocean", 0.001],
  ["tileBrick", 0.001],
  ["tileDesert", 0.001],
  ["tileGrain", 0.001],
  ["tileLumber", 0.001],
  ["tileOre", 0.001],
  ["tileWool", 0.001],
  ["harbor31", 0.001],
  ["harborBrick", 0.001],
  ["harborGrain", 0.001],
  ["harborLumber", 0.001],
  ["harborOre", 0.001],
  ["harborWool", 0.001],
  ["counter2", 0.001],
  ["counter3", 0.001],
  ["counter4", 0.001],
  ["counter5", 0.001],
  ["counter6", 0.001],
  ["counter8", 0.001],
  ["counter9", 0.001],
  ["counter10", 0.001],
  ["counter11", 0.001],
  ["counter12", 0.001],
  ["resourceCardBrick", 0.0003],
  ["resourceCardGrain", 0.0003],
  ["resourceCardLumber", 0.0003],
  ["resourceCardOre", 0.0003],
  ["resourceCardWool", 0.0003],
  ["knightCard", 0.0003],
  ["roadBuildingCard", 0.0003],
  ["yearOfPlentyCard", 0.0003],
  ["monopolyCard", 0.0003],
  ["chapelCard", 0.0003],
  ["greatHallCard", 0.0003],
  ["libraryCard", 0.0003],
  ["marketCard", 0.0003],
  ["universityCard", 0.0003],
  ["largestArmyCard", 0.001],
  ["longestRoadCard", 0.001],
  ["buildingCostCard", 0.001],
  ["businessCard", 0.000175],
  ["road", 0.002],
  ["house", 0.006],
  ["settlement", 0.0085],
  ["robber", 0],
]);

const halfY = (template) => halfYByTemplate.get(template) ?? 0;
const localY = (template, parentTemplate = null) =>
  Number((halfY(parentTemplate) + halfY(template)).toFixed(6));
const position = (template, x, z, parentTemplate = null) => [x, null, z];

const stackChildren = ({ template, name, level = 2, count, tint, rotation }) => {
  if (level > count) return undefined;
  return [{
    template,
    name: `${name}-${level}`,
    position: position(template, 0, 0, template),
    tint,
    rotation,
    children: stackChildren({ template, name, level: level + 1, count, tint, rotation }),
  }];
};

const stack = ({ template, name, count, x, z, tint, rotation }) => ({
  template,
  name: `${name}-1`,
  position: position(template, x, z),
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
    position: position(card.template, 0, 0, parent.template),
    children: mixedStackChildren(cards, index + 1),
  }];
};

const mixedStack = ({ cards, x, z }) => {
  const [first] = cards;
  return {
    template: first.template,
    name: `${first.name}-${first.count}`,
    position: position(first.template, x, z),
    children: mixedStackChildren(cards),
  };
};

const repeatedCards = (template, name, count) =>
  Array.from({ length: count }, (_, index) => ({ template, name, count: index + 1 }));

const row = ({ template, name, count, x, z, spacing, tint = "red" }) =>
  Array.from({ length: count }, (_, index) => ({
    template,
    name: `${name} ${index + 1}`,
    position: position(template, x, Number((z + index * spacing).toFixed(4))),
    tint,
  }));

const logStack = ({ label, x, z, columns = 5, height = 3, spacing = 0.005, tint }) =>
  row({ template: "road", name: `${label} log stack`, count: columns, x, z, spacing, tint })
    .map((piece, index) => ({
      ...piece,
      name: `${label} ROAD ${index + 1}-1`,
      children: stackChildren({ template: "road", name: `${label} ROAD ${index + 1}`, count: height, tint }),
    }));

const woodenSupply = ({ label, tint, x, z }) => [
  ...logStack({ label, tint, x, z }),
  ...row({ template: "settlement", name: `${label} SETTLEMENT`, count: 5, x, z: z + 0.1, spacing: 0.012, tint }),
  ...row({ template: "house", name: `${label} CITY`, count: 4, x, z: z + 0.19, spacing: 0.012, tint }),
];

const templates = {
  ocean: { name: "OCEAN BOARD", src: "models/ocean.gltf", locked: true },
  tileBrick: { name: "BRICK TILE", src: "models/tile-brick.gltf", locked: true },
  tileDesert: { name: "DESERT TILE", src: "models/tile-desert.gltf", locked: true },
  tileGrain: { name: "GRAIN TILE", src: "models/tile-grain.gltf", locked: true },
  tileLumber: { name: "LUMBER TILE", src: "models/tile-lumber.gltf", locked: true },
  tileOre: { name: "ORE TILE", src: "models/tile-ore.gltf", locked: true },
  tileWool: { name: "WOOL TILE", src: "models/tile-wool.gltf", locked: true },
  harbor31: { name: "3:1 HARBOR", src: "models/harbor-3-1.gltf", locked: true },
  harborBrick: { name: "BRICK 2:1 HARBOR", src: "models/harbor-brick.gltf", locked: true },
  harborGrain: { name: "GRAIN 2:1 HARBOR", src: "models/harbor-grain.gltf", locked: true },
  harborLumber: { name: "LUMBER 2:1 HARBOR", src: "models/harbor-lumber.gltf", locked: true },
  harborOre: { name: "ORE 2:1 HARBOR", src: "models/harbor-ore.gltf", locked: true },
  harborWool: { name: "WOOL 2:1 HARBOR", src: "models/harbor-wool.gltf", locked: true },
  robber: { name: "ROBBER", src: "models/robber.gltf" },
  road: { name: "ROAD", src: "models/road.gltf" },
  settlement: { name: "SETTLEMENT", src: "models/settlement.gltf" },
  house: { name: "CITY", src: "models/house.gltf" },
  ...Object.fromEntries([2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((value) => [
    `counter${value}`,
    { name: `${value} COUNTER`, src: `models/counter-${value}.gltf`, locked: true },
  ])),
  resourceCardBrick: { name: "BRICK RESOURCE CARD", src: "models/resource-card-brick.gltf" },
  resourceCardGrain: { name: "GRAIN RESOURCE CARD", src: "models/resource-card-grain.gltf" },
  resourceCardLumber: { name: "LUMBER RESOURCE CARD", src: "models/resource-card-lumber.gltf" },
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
const hexXStep = 0.0789;
const hexZStep = 0.0683;
const hex = (q, r) => [
  Number((hexXStep * (q + r / 2)).toFixed(4)),
  Number((hexZStep * r).toFixed(4)),
];

const boardTiles = [
  ["Ore", 5, -0.0789, -0.1366],
  ["Grain", 2, 0, -0.1366],
  ["Lumber", 6, 0.0789, -0.1366],
  ["Wool", 3, -0.1183, -0.0683],
  ["Brick", 8, -0.0394, -0.0683],
  ["Ore", 10, 0.0394, -0.0683],
  ["Grain", 9, 0.1183, -0.0683],
  ["Lumber", 11, -0.1577, 0],
  ["Wool", 4, -0.0789, 0],
  ["Desert", null, 0, 0],
  ["Brick", 3, 0.0789, 0],
  ["Ore", 8, 0.1577, 0],
  ["Grain", 4, -0.1183, 0.0683],
  ["Lumber", 10, -0.0394, 0.0683],
  ["Wool", 9, 0.0394, 0.0683],
  ["Brick", 12, 0.1183, 0.0683],
  ["Wool", 6, -0.0789, 0.1366],
  ["Grain", 5, 0, 0.1366],
  ["Lumber", 11, 0.0789, 0.1366],
];

const harbors = [
  ["harbor31", "Generic harbor 1", 0, -3],
  ["harborBrick", "Brick harbor", 2, -3],
  ["harbor31", "Generic harbor 2", 3, -2],
  ["harborLumber", "Lumber harbor", 3, 0],
  ["harborWool", "Wool harbor", 1, 2],
  ["harborOre", "Ore harbor", -1, 3],
  ["harbor31", "Generic harbor 3", -3, 3],
  ["harborGrain", "Grain harbor", -3, 1],
  ["harbor31", "Generic harbor 4", -2, -1],
].map(([template, name, q, r]) => {
  const [x, z] = hex(q, r);
  return { template, name, position: position(template, x, z, "ocean") };
});

const tilePiece = ([resource, counter, x, z]) => {
  const displayResource = resource.toUpperCase();
  const piece = {
    template: tileTemplate(resource),
    name: counter === null ? "DESERT" : `${displayResource} ${counter}`,
    position: position(tileTemplate(resource), x, z, "ocean"),
    children: [],
  };
  if (counter === null) {
    piece.children.push({ template: "robber", name: "ROBBER", position: position("robber", 0, 0, tileTemplate(resource)) });
  } else {
    piece.children.push({
      template: `counter${counter}`,
      name: `${displayResource} ${counter} COUNTER`,
      position: position(`counter${counter}`, 0, 0, tileTemplate(resource)),
    });
  }
  return piece;
};

const cardStacks = [
  ["resourceCardBrick", "BRICK RESOURCE CARD", 19, -0.18],
  ["resourceCardLumber", "LUMBER RESOURCE CARD", 19, -0.09],
  ["resourceCardWool", "WOOL RESOURCE CARD", 19, 0],
  ["resourceCardGrain", "GRAIN RESOURCE CARD", 19, 0.09],
  ["resourceCardOre", "ORE RESOURCE CARD", 19, 0.18],
].map(([template, name, count, z]) => stack({ template, name, count, x: 0.34, z, rotation: [180, 0, 0] }));

const actionCardStack = mixedStack({
  x: 0.34,
  z: 0.31,
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
  ["businessCard", "BUSINESS CARD", -0.21],
  ["largestArmyCard", "LARGEST ARMY CARD", -0.08, [180, 0, 0]],
  ["longestRoadCard", "LONGEST ROAD CARD", 0.08, [180, 0, 0]],
  ["buildingCostCard", "BUILDING COST CARD", 0.25, [180, 0, 0]],
].map(([template, name, z, rotation]) => stack({ template, name, count: 1, x: -0.35, z, rotation }));

const explicitY = (pieces, parentTemplate = null) => {
  for (const piece of pieces) {
    if (Array.isArray(piece.position)) {
      piece.position[1] = localY(piece.template, parentTemplate);
    }
    if (piece.children) {
      explicitY(piece.children, piece.template);
    }
  }
};

const sidePieces = [
  ...cardStacks,
  actionCardStack,
  ...awardCards,
  ...woodenSupply({ label: "RED", tint: "red", x: 0.43, z: -0.12 }),
  ...woodenSupply({ label: "BLUE", tint: "blue", x: 0.5, z: -0.12 }),
  ...woodenSupply({ label: "WHITE", tint: "white", x: 0.57, z: -0.12 }),
  ...woodenSupply({ label: "ORANGE", tint: "orange", x: 0.64, z: -0.12 }),
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
        position: position("ocean", 0, 0),
        children: [
          ...boardTiles.map(tilePiece),
          ...harbors,
        ],
      },
      ...sidePieces,
    ],
  }],
};

// explicitY(manifest.scenarios[0].children);

await mkdir(distDir, { recursive: true });
await writeFile(outputManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(outputPackagePath, `${JSON.stringify({
  name: "settlers-probability-example",
  version: "0.0.0",
  private: true,
  main: "probability.json",
}, null, 2)}\n`);
console.log("Generated dist package");
