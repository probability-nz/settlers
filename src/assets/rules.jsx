import React from 'react';
import { Text } from '../svg.jsx';

// Rulebook (mohitagw15856), CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
// https://github.com/mohitagw15856/rulebook/blob/main/games/catan/rules.md
// Layout reformatted; resource emojis added to the tables.
function RuleText(props) {
  return <Text size={3.8} lineHeight={4.7} align="start" fill="#242522" {...props} />;
}

export function Rules() {
  return (
    <>
      <rect width={297} height={210} fill="#f7f3e8" />
      <RuleText x={12} y={18} size={8} bold>{"CATAN"}</RuleText>
      <RuleText x={12} y={27}>{"Build settlements on a board that pays out on dice rolls, and trade for the resources you are short of.\nThe trading is the game; the building is the scoreboard."}</RuleText>
      <RuleText x={12} y={43} size={4.5} bold fill="#7d302e">{"The board"}</RuleText>
      <RuleText x={12} y={49.5}>{"Nineteen hexes, each a terrain type producing one\nresource, each with a number token from 2 to 12 (the\ndesert has none and starts with the robber)."}</RuleText>
      <RuleText x={12} y={65.2} bold>{"Terrain"}</RuleText>
      <RuleText x={116} y={65.2} bold>{"Produces"}</RuleText>
      <RuleText x={12} y={69.9}>{"Forest"}</RuleText>
      <RuleText x={116} y={69.9}>{"🪵 Lumber"}</RuleText>
      <RuleText x={12} y={74.6}>{"Hills"}</RuleText>
      <RuleText x={116} y={74.6}>{"🧱 Brick"}</RuleText>
      <RuleText x={12} y={79.3}>{"Fields"}</RuleText>
      <RuleText x={116} y={79.3}>{"🌽 Grain"}</RuleText>
      <RuleText x={12} y={84}>{"Pasture"}</RuleText>
      <RuleText x={116} y={84}>{"🐑 Wool"}</RuleText>
      <RuleText x={12} y={88.7}>{"Mountains"}</RuleText>
      <RuleText x={116} y={88.7}>{"🪨 Ore"}</RuleText>
      <RuleText x={12} y={93.4}>{"Desert"}</RuleText>
      <RuleText x={116} y={93.4}>{"Nothing"}</RuleText>
      <RuleText x={12} y={104.1} size={4.5} bold fill="#7d302e">{"Setup"}</RuleText>
      <RuleText x={12} y={110.6}>{"In turn order, each player places a settlement and a\nroad. Then, in reverse order, each places a second\nsettlement and road."}</RuleText>
      <RuleText x={12} y={126.3}>{"Collect starting resources from your second settlement\nonly — one card for each adjacent terrain hex."}</RuleText>
      <RuleText x={12} y={141.3} size={4.5} bold fill="#7d302e">{"Rolling a 7"}</RuleText>
      <RuleText x={12} y={147.8}>{"No resources are produced. Instead:"}</RuleText>
      <RuleText x={12} y={154.1}>{"- Every player holding more than seven resource cards\ndiscards half, rounded down."}</RuleText>
      <RuleText x={12} y={165.1}>{"- The roller moves the robber to any other hex,\nblocking its production, and steals one random card\nfrom a player with a settlement touching it."}</RuleText>
      <RuleText x={155} y={43} size={4.5} bold fill="#7d302e">{"A turn"}</RuleText>
      <RuleText x={155} y={49.5}>{"1. Roll two dice. Every player with a settlement\ntouching a hex showing that number collects one\nresource from it; a city collects two."}</RuleText>
      <RuleText x={155} y={65.2}>{"2. Trade — with other players, or with the bank at\n4:1, or at a port you have built on."}</RuleText>
      <RuleText x={155} y={76.2}>{"3. Build — spend resources:"}</RuleText>
      <RuleText x={155} y={82.5} bold>{"Build"}</RuleText>
      <RuleText x={207} y={82.5} bold>{"Cost"}</RuleText>
      <RuleText x={155} y={87.2}>{"Road"}</RuleText>
      <RuleText x={207} y={87.2}>{"🪵 + 🧱"}</RuleText>
      <RuleText x={155} y={91.9}>{"Settlement"}</RuleText>
      <RuleText x={207} y={91.9}>{"🪵 + 🧱 + 🌽 + 🐑"}</RuleText>
      <RuleText x={155} y={96.6}>{"City (upgrades a\nsettlement)"}</RuleText>
      <RuleText x={207} y={96.6}>{"🪨🪨🪨 + 🌽🌽"}</RuleText>
      <RuleText x={155} y={106}>{"Development card"}</RuleText>
      <RuleText x={207} y={106}>{"🪨 + 🌽 + 🐑"}</RuleText>
      <RuleText x={155} y={116.7} size={4.5} bold fill="#7d302e">{"Victory points"}</RuleText>
      <RuleText x={155} y={123.2} bold>{"Source"}</RuleText>
      <RuleText x={259} y={123.2} bold>{"Points"}</RuleText>
      <RuleText x={155} y={127.9}>{"Settlement"}</RuleText>
      <RuleText x={259} y={127.9}>{"1"}</RuleText>
      <RuleText x={155} y={132.6}>{"City"}</RuleText>
      <RuleText x={259} y={132.6}>{"2"}</RuleText>
      <RuleText x={155} y={137.3}>{"Longest Road (5+ segments, most)"}</RuleText>
      <RuleText x={259} y={137.3}>{"2"}</RuleText>
      <RuleText x={155} y={142}>{"Largest Army (3+ knights, most)"}</RuleText>
      <RuleText x={259} y={142}>{"2"}</RuleText>
      <RuleText x={155} y={146.7}>{"Victory point development card"}</RuleText>
      <RuleText x={259} y={146.7}>{"1 each"}</RuleText>
      <RuleText x={155} y={153.4}>{"First to ten wins. You announce it on your own turn —\ndevelopment card points stay hidden until then, which\nis why games often end a turn before everyone expects."}</RuleText>
      <RuleText x={155} y={173.1} size={4.5} bold fill="#7d302e">{"Placement restrictions"}</RuleText>
      <RuleText x={155} y={179.6}>{"Settlements must be at least two intersections apart,\nand roads must connect to your own network."}</RuleText>
      <RuleText x={285} y={202} align="end">{"CC-BY 4.0 https://github.com/mohitagw15856/rulebook"}</RuleText>
    </>
  );
}
