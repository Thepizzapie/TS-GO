"use client";
/**
 * Scene — assembles the 3D world inside the Canvas: lighting, atmosphere, the
 * map, all tomatoes, world objects, effects, the viewmodel, and the local
 * controller. The art pass may enrich lighting/atmosphere but should keep the
 * component composition.
 */
import { useMemo } from "react";
import type { GameEngine } from "../net/engine";
import { getMap } from "../core/maps";
import { Environment } from "./Environment";
import { MapMesh } from "./MapMesh";
import { RemotePlayers } from "./RemotePlayers";
import { WorldEntities } from "./WorldEntities";
import { Effects } from "./Effects";
import { Viewmodel } from "./Viewmodel";
import { LocalController } from "./LocalController";
import { FxAudio } from "./FxAudio";
import { PostFX } from "./PostFX";

export function Scene({ engine }: { engine: GameEngine }) {
  const map = useMemo(() => getMap(engine.state.config.mapId), [engine]);
  return (
    <>
      <Environment map={map} />

      <MapMesh map={map} />
      <RemotePlayers engine={engine} />
      <WorldEntities engine={engine} />
      <Effects engine={engine} />
      <Viewmodel engine={engine} />

      <LocalController engine={engine} />
      <FxAudio engine={engine} />
      <PostFX />
    </>
  );
}
