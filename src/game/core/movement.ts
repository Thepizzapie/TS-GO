/**
 * TOMATO STRIKE — player movement integrator.
 *
 * Quake-flavored ground/air accel with friction, gravity, crouch and jump,
 * resolved against the map via collision.stepBody. Shared verbatim by the local
 * client predictor (your own tomato) and the host (bot tomatoes), so movement
 * feels identical no matter who's driving.
 */
import type { MapDef, PlayerInput, PlayerState, Vec3 } from "./types";
import { WEAPONS } from "./weapons";
import { stepBody } from "./collision";
import {
  AIR_ACCEL,
  AIR_SPEED,
  CROUCH_HEIGHT,
  CROUCH_SPEED,
  EYE_CROUCH,
  EYE_STAND,
  FRICTION,
  GRAVITY,
  GROUND_ACCEL,
  JUMP_SPEED,
  PLAYER_RADIUS,
  RUN_SPEED,
  STAND_HEIGHT,
  WALK_SPEED,
} from "./constants";
import { clamp } from "./vec";

/** World-space eye position (camera / muzzle origin). */
export function eyePos(p: PlayerState): Vec3 {
  return [p.pos[0], p.pos[1] + (p.crouching ? EYE_CROUCH : EYE_STAND), p.pos[2]];
}

export function playerHeight(p: PlayerState): number {
  return p.crouching ? CROUCH_HEIGHT : STAND_HEIGHT;
}

function applyFriction(vel: Vec3, dt: number): void {
  const speed = Math.hypot(vel[0], vel[2]);
  if (speed < 0.1) {
    vel[0] = 0;
    vel[2] = 0;
    return;
  }
  const drop = speed * FRICTION * dt;
  const scale = Math.max(0, speed - drop) / speed;
  vel[0] *= scale;
  vel[2] *= scale;
}

function accelerate(vel: Vec3, wishX: number, wishZ: number, wishSpeed: number, accel: number, dt: number): void {
  const current = vel[0] * wishX + vel[2] * wishZ;
  const add = wishSpeed - current;
  if (add <= 0) return;
  let accelSpeed = accel * dt * wishSpeed;
  if (accelSpeed > add) accelSpeed = add;
  vel[0] += wishX * accelSpeed;
  vel[2] += wishZ * accelSpeed;
}

/**
 * Advance one player by `dt` seconds under `input`. Mutates the player in place.
 * Returns true if the player just left the ground via a jump (for SFX/anim).
 */
export function applyMovement(p: PlayerState, input: PlayerInput, dt: number, map: MapDef): boolean {
  p.yaw = input.yaw;
  p.pitch = clamp(input.pitch, -1.5, 1.5);
  p.crouching = input.crouch && p.onGround;

  const w = WEAPONS[p.currentWeapon];
  const baseSpeed = p.crouching ? CROUCH_SPEED : input.walk ? WALK_SPEED : RUN_SPEED;
  const wishSpeed = baseSpeed * w.moveScale;

  // Local move axes from yaw. forward = (sin, -cos), right = (cos, sin).
  const fwd: [number, number] = [Math.sin(p.yaw), -Math.cos(p.yaw)];
  const right: [number, number] = [Math.cos(p.yaw), Math.sin(p.yaw)];
  let wx = right[0] * input.move[0] + fwd[0] * input.move[1];
  let wz = right[1] * input.move[0] + fwd[1] * input.move[1];
  const wlen = Math.hypot(wx, wz);
  if (wlen > 1e-4) {
    wx /= wlen;
    wz /= wlen;
  }
  const intent = Math.min(1, Math.hypot(input.move[0], input.move[1]));
  const targetSpeed = wishSpeed * intent;

  let justJumped = false;
  if (p.onGround) {
    applyFriction(p.vel, dt);
    accelerate(p.vel, wx, wz, targetSpeed, GROUND_ACCEL, dt);
    if (input.jump) {
      p.vel[1] = JUMP_SPEED;
      p.onGround = false;
      justJumped = true;
    }
  } else {
    accelerate(p.vel, wx, wz, Math.min(targetSpeed, AIR_SPEED), AIR_ACCEL, dt);
  }

  p.vel[1] -= GRAVITY * dt;

  const res = stepBody(p.pos, p.vel, dt, PLAYER_RADIUS, playerHeight(p), map.boxes, map.bounds);
  p.pos = res.pos;
  p.vel = res.vel;
  p.onGround = res.onGround;
  return justJumped;
}
