"use client";
/**
 * PostFX — screen-space post-processing: bloom on emissive elements (muzzle
 * flashes, tracers, the bomb, neon trim) + a soft vignette. The art pass may
 * extend this (SSAO, color grading, chromatic aberration on hits).
 */
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

export function PostFX() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.7} luminanceThreshold={0.28} luminanceSmoothing={0.22} mipmapBlur radius={0.6} />
      <Vignette offset={0.22} darkness={0.55} eskil={false} />
    </EffectComposer>
  );
}
