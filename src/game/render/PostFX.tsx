"use client";
/**
 * PostFX — screen-space post-processing: bloom on emissive elements (muzzle
 * flashes, tracers, the bomb, neon trim) + a soft vignette.
 *
 * V5: ChromaticAberration spikes on taking damage (~200ms decay). Driven via
 *     ref in useFrame — NO React re-renders in the frame loop.
 * V6: DepthOfField while sniper-scoped; toggle/drive via refs from store.
 *     Both effects are inert (zero-offset / disabled) when idle.
 * V7: RetroEffect (posterize + 4×4 Bayer dither + scanlines). Toggled via
 *     settings.retroFx read from store inside useFrame — NO composer rebuild.
 *     When off: levels=255, ditherAmt=0, scanlineAmt=0 (passthrough).
 *     When on:  levels=14, ditherAmt=1, scanlineAmt=0.05.
 */
import { useRef, type Ref } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, ChromaticAberration, DepthOfField } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { useGameStore } from "../state/store";
import { RetroEffect, type RetroEffectImpl } from "./retro-effect";

// Chromatic aberration effect ref type (postprocessing internal)
type ChromaAberrationEffect = {
  offset: THREE.Vector2;
};

type DofEffect = {
  bokehScale: number;
  focusDistance: number;
};

const CHROMA_PEAK = 0.0065;
const CHROMA_DECAY = 5.5;

// Module-level so the prop reference never changes between renders.
const CHROMA_ZERO = new THREE.Vector2(0, 0);

// RetroEffect "on" and "off" uniform targets
const RETRO_ON = { levels: 14, ditherAmt: 1, scanlineAmt: 0.05 } as const;
const RETRO_OFF = { levels: 255, ditherAmt: 0, scanlineAmt: 0 } as const;

export function PostFX() {
  const chromaRef = useRef<ChromaAberrationEffect>(null);
  const dofRef = useRef<DofEffect>(null);
  // Two retro refs: one for each composer branch (scoped / unscoped).
  // Both are always mounted; we only need the active one, but keeping both
  // avoids any ref mismatch after a scoped toggle.
  const retroScopedRef = useRef<RetroEffectImpl>(null);
  const retroUnscopedRef = useRef<RetroEffectImpl>(null);

  const scoped = useGameStore((s) => s.scoped);

  const chromaAmt = useRef(0);
  const lastHp = useRef(100);

  useFrame((_, dt) => {
    // --- V5: chromatic aberration driven by HP drops -------------------------
    const st = useGameStore.getState();
    const me = st.game?.players[st.myId];
    if (me) {
      if (me.hp < lastHp.current) {
        const dmgFrac = Math.min(1, (lastHp.current - me.hp) / 40);
        chromaAmt.current = Math.max(chromaAmt.current, CHROMA_PEAK * (0.4 + dmgFrac * 0.6));
      }
      lastHp.current = me.hp;
    } else {
      lastHp.current = 100;
    }

    chromaAmt.current *= 1 - Math.min(1, dt * CHROMA_DECAY);
    if (chromaAmt.current < 0.0001) chromaAmt.current = 0;

    if (chromaRef.current) {
      const v = chromaAmt.current;
      chromaRef.current.offset.set(v, v * 0.6);
    }

    // --- V6: depth of field ---------------------------------------------------
    if (dofRef.current) {
      dofRef.current.bokehScale += (6 - dofRef.current.bokehScale) * Math.min(1, dt * 10);
    }

    // --- V7: retro effect uniform update (no composer rebuild) ---------------
    const retroOn = st.settings.retroFx;
    const target = retroOn ? RETRO_ON : RETRO_OFF;
    // Drive whichever ref is currently mounted in the active branch.
    const retroRef = scoped ? retroScopedRef.current : retroUnscopedRef.current;
    if (retroRef) {
      retroRef.levels = target.levels;
      retroRef.ditherAmt = target.ditherAmt;
      retroRef.scanlineAmt = target.scanlineAmt;
    }
  });

  const bloom = <Bloom intensity={0.7} luminanceThreshold={0.28} luminanceSmoothing={0.22} mipmapBlur radius={0.6} />;
  const vignette = <Vignette offset={0.22} darkness={0.55} eskil={false} />;
  const chroma = (
    <ChromaticAberration
      // @ts-expect-error ref type from postprocessing internals
      ref={chromaRef}
      offset={CHROMA_ZERO}
      blendFunction={BlendFunction.NORMAL}
      radialModulation={false}
      modulationOffset={0}
    />
  );

  // RetroEffect starts in "on" state (retroFx defaults to true in store).
  // Initial props match RETRO_ON; useFrame adjusts them from the first frame.
  const retro = (ref: Ref<RetroEffectImpl>) => (
    <RetroEffect
      // @ts-expect-error wrapEffect ref type
      ref={ref}
      args={[{ levels: 14, ditherAmt: 1, scanlineAmt: 0.05 }]}
    />
  );

  return scoped ? (
    <EffectComposer multisampling={4}>
      {bloom}
      {vignette}
      {chroma}
      <DepthOfField
        // @ts-expect-error ref type from postprocessing internals
        ref={dofRef}
        focusDistance={0.006}
        focalLength={0.022}
        bokehScale={0}
      />
      {retro(retroScopedRef)}
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={4}>
      {bloom}
      {vignette}
      {chroma}
      {retro(retroUnscopedRef)}
    </EffectComposer>
  );
}
