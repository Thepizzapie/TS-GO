/**
 * retro-effect.ts — custom postprocessing Effect for the retro CRT grade.
 *
 * Per-channel posterize (14 levels default) with a 4×4 Bayer ordered-dither
 * offset (±1/(2·levels)) before quantization, plus subtle scanline darkening.
 *
 * Merges into the existing single EffectPass — roughly 10 ALU ops/pixel, no
 * extra full-screen pass, no resolution downscale (would hurt aim).
 *
 * Uniforms:
 *   levels      — quantize steps per channel (default 14; set to 255 to bypass)
 *   ditherAmt   — 0 → 1 dither mix (default 1)
 *   scanlineAmt — dark-band strength 0..1 (default 0.05)
 *
 * React wrapper: RetroEffect component (forwardRef) via wrapEffect utility.
 * Drive uniforms by ref in useFrame — no composer rebuild on toggle.
 */
import * as React from "react";
import * as THREE from "three";
import { Effect, BlendFunction } from "postprocessing";
import { wrapEffect } from "@react-three/postprocessing";

// ---------------------------------------------------------------------------
// 4×4 Bayer matrix (normalised 0..1, values 0/16 … 15/16)
// ---------------------------------------------------------------------------
const BAYER4 = `
  float bayer4(ivec2 p) {
    const float m[16] = float[16](
       0.0, 8.0, 2.0,10.0,
      12.0, 4.0,14.0, 6.0,
       3.0,11.0, 1.0, 9.0,
      15.0, 7.0,13.0, 5.0
    );
    int idx = (p.x & 3) + (p.y & 3) * 4;
    return (m[idx] / 16.0) - 0.5; // range -0.5 .. ~0.44
  }
`;

// ---------------------------------------------------------------------------
// Fragment shader (injected into postprocessing's effect framework)
// ---------------------------------------------------------------------------
const FRAGMENT = /* glsl */ `
  uniform float levels;
  uniform float ditherAmt;
  uniform float scanlineAmt;

  ${BAYER4}

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 col = inputColor.rgb;

    // Bayer dither offset in colour space before quantisation
    ivec2 pix = ivec2(gl_FragCoord.xy);
    float dither = bayer4(pix) / levels;

    // Posterize per channel
    vec3 dithered = col + dither * ditherAmt;
    vec3 posterized = floor(dithered * levels + 0.5) / levels;

    // Scanline darkening — alternating pairs of rows
    float scanline = 1.0 - scanlineAmt * float((pix.y & 1) == 0);

    outputColor = vec4(posterized * scanline, inputColor.a);
  }
`;

// ---------------------------------------------------------------------------
// Effect subclass
// ---------------------------------------------------------------------------

export class RetroEffectImpl extends Effect {
  constructor({
    levels = 14,
    ditherAmt = 1.0,
    scanlineAmt = 0.05,
  }: {
    levels?: number;
    ditherAmt?: number;
    scanlineAmt?: number;
  } = {}) {
    super("RetroEffect", FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["levels", new THREE.Uniform(levels)],
        ["ditherAmt", new THREE.Uniform(ditherAmt)],
        ["scanlineAmt", new THREE.Uniform(scanlineAmt)],
      ]),
    });
  }

  /** Convenience setters so PostFX can drive values via ref. */
  set levels(v: number) {
    (this.uniforms.get("levels") as THREE.Uniform).value = v;
  }
  get levels(): number {
    return (this.uniforms.get("levels") as THREE.Uniform).value as number;
  }

  set ditherAmt(v: number) {
    (this.uniforms.get("ditherAmt") as THREE.Uniform).value = v;
  }
  get ditherAmt(): number {
    return (this.uniforms.get("ditherAmt") as THREE.Uniform).value as number;
  }

  set scanlineAmt(v: number) {
    (this.uniforms.get("scanlineAmt") as THREE.Uniform).value = v;
  }
  get scanlineAmt(): number {
    return (this.uniforms.get("scanlineAmt") as THREE.Uniform).value as number;
  }
}

// ---------------------------------------------------------------------------
// React component wrapper (forwardRef via wrapEffect)
// wrapEffect calls extend({ RetroEffect: RetroEffectImpl }) on first render and
// renders the r3f catalog entry with the given args/props, forwarding the ref
// so PostFX can reach the effect's uniform setters.
// ---------------------------------------------------------------------------

export const RetroEffect = wrapEffect(RetroEffectImpl);
