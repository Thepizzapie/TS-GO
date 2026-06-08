"use client";
/**
 * TOMATO STRIKE — first-person controller for the local tomato.
 *
 * Owns pointer lock, keyboard/mouse sampling, the camera rig, client-side
 * movement prediction (via engine.setInput), and hitscan shooting with recoil +
 * spread. Runs entirely inside the r3f frame loop; reads/writes engine state
 * directly (no React re-renders on the hot path).
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import type { GameEngine } from "../net/engine";
import type { PlayerInput, PlayerState, ShotMsg, Vec3 } from "../core/types";
import { WEAPONS } from "../core/weapons";
import { getMap } from "../core/maps";
import { eyePos, playerHeight } from "../core/movement";
import { raycastPlayers } from "../core/collision";
import { aimDir, clamp } from "../core/vec";
import {
  AIR_INACCURACY,
  MOVE_INACCURACY,
  STILL_THRESHOLD,
  KNIFE_RANGE,
} from "../core/constants";
import { useGameStore } from "../state/store";
import { audio } from "../audio/engine";
import { weaponSoundId } from "../audio/types";

const SLOT_KEYS: Record<string, "primary" | "secondary" | "melee" | "grenade"> = {
  Digit1: "primary",
  Digit2: "secondary",
  Digit3: "melee",
  Digit4: "grenade",
};

export function LocalController({ engine }: { engine: GameEngine }) {
  const { camera, gl } = useThree();
  const keys = useRef<Set<string>>(new Set());
  const mouseDown = useRef(false);
  const prevMouse = useRef(false);
  const baseYaw = useRef(0);
  const basePitch = useRef(0);
  const rYaw = useRef(0);
  const rPitch = useRef(0);
  const lastShot = useRef(0);
  const lastStep = useRef(0);
  const wantThrow = useRef(false);

  // --- input listeners ------------------------------------------------------
  useEffect(() => {
    const me = engine.me;
    if (me) baseYaw.current = me.yaw;
    camera.rotation.order = "YXZ";

    const dom = gl.domElement;
    const ui = () => useGameStore.getState();

    const onKeyDown = (e: KeyboardEvent) => {
      // never swallow devtools / refresh
      if (e.code === "Tab") {
        e.preventDefault();
        ui().setUi({ scoreboard: true });
        return;
      }
      keys.current.add(e.code);
      if (e.code === "KeyB") {
        const s = ui();
        const open = !s.buyOpen;
        s.setUi({ buyOpen: open });
        if (open) document.exitPointerLock?.();
        else dom.requestPointerLock?.();
      }
      if (e.code === "KeyR") engine.reload(), audio.play("reload_start");
      if (e.code in SLOT_KEYS) switchToSlot(SLOT_KEYS[e.code]);
      if (e.code === "KeyG") wantThrow.current = true;
      if (e.code === "Escape") {
        ui().setUi({ buyOpen: false });
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      if (e.code === "Tab") ui().setUi({ scoreboard: false });
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseDown.current = true;
      if (e.button === 2) {
        // right-click could scope later; ignore for now
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseDown.current = false;
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== dom) return;
      const s = ui().settings;
      const k = 0.0022 * s.sensitivity;
      baseYaw.current += e.movementX * k;
      const dy = e.movementY * k * (s.invertY ? -1 : 1);
      basePitch.current = clamp(basePitch.current - dy, -1.5, 1.5);
    };
    const onContext = (e: Event) => e.preventDefault();
    const onLockChange = () => {
      const locked = document.pointerLockElement === dom;
      ui().setUi({ pointerLocked: locked });
      if (!locked && !ui().buyOpen) ui().setUi({ paused: true });
    };
    const onClick = () => {
      const s = ui();
      if (!s.buyOpen && !s.paused) dom.requestPointerLock?.();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMove);
    dom.addEventListener("contextmenu", onContext);
    dom.addEventListener("click", onClick);
    document.addEventListener("pointerlockchange", onLockChange);

    function switchToSlot(slot: "primary" | "secondary" | "melee" | "grenade") {
      const m = engine.me;
      if (!m) return;
      const item = m.inventory.find((i) => WEAPONS[i.id].slot === slot);
      if (item) engine.switchWeapon(item.id);
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMove);
      dom.removeEventListener("contextmenu", onContext);
      dom.removeEventListener("click", onClick);
      document.removeEventListener("pointerlockchange", onLockChange);
    };
  }, [engine, camera, gl]);

  // --- per-frame loop -------------------------------------------------------
  useFrame((_, dt) => {
    const me = engine.me;
    if (!me) return;
    const store = useGameStore.getState();
    const active = store.pointerLocked && !store.buyOpen && !store.paused;

    // recoil recovery
    const recovering = !mouseDown.current;
    const rec = recovering ? 0.86 : 0.94;
    rPitch.current *= rec;
    rYaw.current *= rec;

    const yaw = baseYaw.current + rYaw.current;
    const pitch = clamp(basePitch.current + rPitch.current, -1.5, 1.5);

    // build input
    const k = keys.current;
    const fwd = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const strafe = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    const input: PlayerInput = {
      move: active ? [strafe, fwd] : [0, 0],
      yaw,
      pitch,
      jump: active && k.has("Space"),
      crouch: active && (k.has("ControlLeft") || k.has("ControlRight") || k.has("KeyC")),
      walk: active && k.has("ShiftLeft"),
      using: active && k.has("KeyE"),
      seq: 0,
      t: 0,
    };
    engine.setInput(input);

    // camera follows predicted body
    const eye = eyePos(me);
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.rotation.set(pitch, -yaw, 0);
    const wantFov = store.settings.fov;
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera && Math.abs(cam.fov - wantFov) > 0.5) {
      cam.fov = wantFov;
      cam.updateProjectionMatrix();
    }

    // footsteps
    const speed = Math.hypot(me.vel[0], me.vel[2]);
    if (me.alive && me.onGround && speed > 1.5 && !input.walk) {
      const interval = 0.34;
      lastStep.current += dt;
      if (lastStep.current > interval) {
        lastStep.current = 0;
        audio.play("footstep", { volume: 0.5, rate: 0.9 + Math.random() * 0.2 });
      }
    }

    // throwing
    if (wantThrow.current) {
      wantThrow.current = false;
      tryThrow(me, eye, yaw, pitch);
    }

    // shooting
    if (active && me.alive) handleFire(me, eye, yaw, pitch, dt);
    prevMouse.current = mouseDown.current;
  });

  function tryThrow(me: PlayerState, eye: Vec3, yaw: number, pitch: number) {
    const nade = me.inventory.find((i) => WEAPONS[i.id].slot === "grenade");
    if (!nade) return;
    const dir = aimDir(yaw, pitch);
    engine.throwNade({ weapon: nade.id, origin: eye, dir, power: 0.8 });
    audio.play("nade_throw");
  }

  function handleFire(me: PlayerState, eye: Vec3, yaw: number, pitch: number, _dt: number) {
    const w = WEAPONS[me.currentWeapon];
    const isMelee = w.slot === "melee";
    const isNade = w.slot === "grenade";
    if (isNade) {
      if (mouseDown.current && !prevMouse.current) tryThrow(me, eye, yaw, pitch);
      return;
    }
    const wantFire = w.auto ? mouseDown.current : mouseDown.current && !prevMouse.current;
    if (!wantFire) return;

    const now = performance.now();
    const interval = 60000 / w.rpm;
    if (now - lastShot.current < interval) return;

    const item = me.inventory.find((i) => i.id === me.currentWeapon);
    if (!isMelee && (!item || item.ammo <= 0)) {
      if (!prevMouse.current) audio.play("dryfire");
      return;
    }
    lastShot.current = now;

    // spread (degrees) → radians
    const speed = Math.hypot(me.vel[0], me.vel[2]);
    let spreadDeg = w.spread;
    if (speed > STILL_THRESHOLD) spreadDeg *= MOVE_INACCURACY * 0.5;
    if (!me.onGround) spreadDeg *= AIR_INACCURACY * 0.4;
    spreadDeg += me.bloom;
    spreadDeg = Math.min(spreadDeg, 14);
    const sd = (spreadDeg * Math.PI) / 180;

    const range = isMelee ? KNIFE_RANGE : w.range;
    const pellets = Math.max(1, w.pellets);
    const others = Object.values(engine.state.players);
    const hits: ShotMsg["hits"] = [];
    let firstDir = aimDir(yaw, pitch);
    let didHit = false;
    let headHit = false;
    for (let p = 0; p < pellets; p++) {
      const jy = yaw + (Math.random() - 0.5) * 2 * sd;
      const jp = clamp(pitch + (Math.random() - 0.5) * 2 * sd, -1.5, 1.5);
      const dir = aimDir(jy, jp);
      if (p === 0) firstDir = dir;
      const hit = raycastPlayers(eye, dir, range, others, me.id, 0.42, playerHeight(me), getMap(engine.state.config.mapId).boxes);
      if (hit && hit.player.team !== me.team) {
        hits.push({ id: hit.player.id, headshot: hit.headshot, dist: hit.dist });
        didHit = true;
        headHit = headHit || hit.headshot;
      }
    }

    const shot: ShotMsg = { weapon: me.currentWeapon, origin: eye, dir: firstDir, hits };
    engine.fire(shot);

    // local feedback
    audio.play(weaponSoundId(me.currentWeapon), { volume: 0.9 });
    if (didHit) {
      audio.play(headHit ? "headshot" : "hitmarker");
      flashHitmarker();
    }

    // recoil kick
    rPitch.current += w.recoil * 0.0042;
    rYaw.current += (Math.random() - 0.5) * w.recoil * 0.003;

    // optimistic ammo for clients (host is authoritative; corrected by snapshot)
    if (engine.role === "client" && item && !isMelee) item.ammo = Math.max(0, item.ammo - 1);
  }

  return null;
}

/** Pulse the crosshair hitmarker via a CSS class on the HUD root. */
function flashHitmarker() {
  if (typeof document === "undefined") return;
  const el = document.getElementById("ts-hitmarker");
  if (!el) return;
  el.classList.remove("ts-hit-pulse");
  // force reflow to restart the animation
  void el.offsetWidth;
  el.classList.add("ts-hit-pulse");
}
