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
  ["victoryPointCard", 0.0003],
  ["largestArmyCard", 0.001],
  ["longestRoadCard", 0.001],
  ["buildingCostCard", 0.001],
  ["road", 0.002],
  ["house", 0.006],
  ["settlement", 0.0085],
  ["robber", 0],
]);

const halfY = (template) => halfYByTemplate.get(template) ?? 0;
const localY = (template, parentTemplate = null) =>
  Number((halfY(parentTemplate) + halfY(template)).toFixed(6));
const position = (template, x, z, parentTemplate = null) => [x, localY(template, parentTemplate), z];

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
      name: `${label} log ${index + 1}-1`,
      children: stackChildren({ template: "road", name: `${label} log ${index + 1}`, count: height, tint }),
    }));

const woodenSupply = ({ label, tint, x, z }) => [
  ...logStack({ label, tint, x, z }),
  ...row({ template: "house", name: `${label} house`, count: 5, x, z: z + 0.1, spacing: 0.012, tint }),
  ...row({ template: "settlement", name: `${label} settlement`, count: 4, x, z: z + 0.19, spacing: 0.012, tint }),
];

const templates = {
  ocean: { name: "Ocean board", src: "models/ocean.gltf", locked: true },
  tileBrick: { name: "Brick tile", src: "models/tile-brick.gltf", locked: true },
  tileDesert: { name: "Desert tile", src: "models/tile-desert.gltf", locked: true },
  tileGrain: { name: "Grain tile", src: "models/tile-grain.gltf", locked: true },
  tileLumber: { name: "Lumber tile", src: "models/tile-lumber.gltf", locked: true },
  tileOre: { name: "Ore tile", src: "models/tile-ore.gltf", locked: true },
  tileWool: { name: "Wool tile", src: "models/tile-wool.gltf", locked: true },
  robber: { name: "Robber", src: "models/robber.gltf" },
  road: { name: "Road", src: "models/road.gltf" },
  settlement: { name: "Settlement", src: "models/settlement.gltf" },
  house: { name: "House", src: "models/house.gltf" },
  ...Object.fromEntries([2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((value) => [
    `counter${value}`,
    { name: `${value} counter`, src: `models/counter-${value}.gltf`, locked: true },
  ])),
  resourceCardBrick: { name: "Brick resource card", src: "models/resource-card-brick.gltf" },
  resourceCardGrain: { name: "Grain resource card", src: "models/resource-card-grain.gltf" },
  resourceCardLumber: { name: "Lumber resource card", src: "models/resource-card-lumber.gltf" },
  resourceCardOre: { name: "Ore resource card", src: "models/resource-card-ore.gltf" },
  resourceCardWool: { name: "Wool resource card", src: "models/resource-card-wool.gltf" },
  knightCard: { name: "Knight card", src: "models/knight-card.gltf" },
  roadBuildingCard: { name: "Road Building card", src: "models/road-building-card.gltf" },
  yearOfPlentyCard: { name: "Year of Plenty card", src: "models/year-of-plenty-card.gltf" },
  monopolyCard: { name: "Monopoly card", src: "models/monopoly-card.gltf" },
  victoryPointCard: { name: "Victory Point card", src: "models/victory-point-card.gltf" },
  largestArmyCard: { name: "Largest Army card", src: "models/largest-army-card.gltf" },
  longestRoadCard: { name: "Longest Road card", src: "models/longest-road-card.gltf" },
  buildingCostCard: { name: "Building Cost card", src: "models/building-cost-card.gltf" },
};

const tileTemplate = (resource) => `tile${resource}`;
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
  ["Ore", 6, -0.0789, 0.1366],
  ["Grain", 5, 0, 0.1366],
  ["Brick", 11, 0.0789, 0.1366],
];

const tilePiece = ([resource, counter, x, z]) => {
  const piece = {
    template: tileTemplate(resource),
    name: counter === null ? "Desert" : `${resource} ${counter}`,
    position: position(tileTemplate(resource), x, z, "ocean"),
    children: [],
  };
  if (counter === null) {
    piece.children.push({ template: "robber", name: "Robber", position: position("robber", 0, 0, tileTemplate(resource)) });
  } else {
    piece.children.push({
      template: `counter${counter}`,
      name: `${resource} ${counter} counter`,
      position: position(`counter${counter}`, 0, 0, tileTemplate(resource)),
    });
  }
  return piece;
};

const cardStacks = [
  ["resourceCardBrick", "Brick resource card", 19, -0.18],
  ["resourceCardLumber", "Lumber resource card", 19, -0.09],
  ["resourceCardWool", "Wool resource card", 19, 0],
  ["resourceCardGrain", "Grain resource card", 19, 0.09],
  ["resourceCardOre", "Ore resource card", 19, 0.18],
].map(([template, name, count, z]) => stack({ template, name, count, x: 0.31, z, rotation: [180, 0, 0] }));

const actionCardStack = mixedStack({
  x: 0.31,
  z: 0.31,
  cards: [
    ...repeatedCards("knightCard", "Knight card", 14),
    ...repeatedCards("roadBuildingCard", "Road Building card", 2),
    ...repeatedCards("yearOfPlentyCard", "Year of Plenty card", 2),
    ...repeatedCards("monopolyCard", "Monopoly card", 2),
    ...repeatedCards("victoryPointCard", "Victory Point card", 5),
  ],
});

const awardCards = [
  ["largestArmyCard", "Largest Army card", -0.08],
  ["longestRoadCard", "Longest Road card", 0.08],
  ["buildingCostCard", "Building Cost card", 0.25],
].map(([template, name, z]) => stack({ template, name, count: 1, x: -0.31, z }));

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
  ...woodenSupply({ label: "Red", tint: "red", x: 0.43, z: -0.12 }),
  ...woodenSupply({ label: "Blue", tint: "blue", x: 0.5, z: -0.12 }),
  ...woodenSupply({ label: "Magenta", tint: "magenta", x: 0.57, z: -0.12 }),
  ...woodenSupply({ label: "Orange", tint: "orange", x: 0.64, z: -0.12 }),
];

const manifest = {
  $schema: SCHEMA_URL,
  templates,
  scenarios: [{
    name: "Premade Settlers Board",
    children: [
      {
        template: "ocean",
        name: "Ocean",
        position: position("ocean", 0, 0),
        children: boardTiles.map(tilePiece),
      },
      ...sidePieces,
    ],
  }],
};

explicitY(manifest.scenarios[0].children);

await mkdir(distDir, { recursive: true });
await writeFile(outputManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(outputPackagePath, `${JSON.stringify({
  name: "settlers-probability-example",
  version: "0.0.0",
  private: true,
  main: "probability.json",
}, null, 2)}\n`);
console.log("Generated dist package");
