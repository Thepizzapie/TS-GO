/** Map registry. Add new MapDefs here to make them selectable in the lobby. */
import type { MapDef } from "../types";
import { de_garden } from "./de_garden";
import { ts_kitchen } from "./ts_kitchen";
import { de_orchard } from "./de_orchard";

export const MAPS: Record<string, MapDef> = {
  [de_garden.id]: de_garden,
  [ts_kitchen.id]: ts_kitchen,
  [de_orchard.id]: de_orchard,
};

export const MAP_LIST: MapDef[] = Object.values(MAPS);

export function getMap(id: string): MapDef {
  return MAPS[id] ?? de_garden;
}
