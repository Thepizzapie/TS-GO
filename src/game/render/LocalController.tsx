"use client";
/**
 * TOMATO STRIKE — first-person controller for the local tomato.
 *
 * Owns pointer lock, input sampling, the camera rig, client-side movement
 * prediction, and hitscan shooting. Feel layer: ADS/scope (right-mouse) with
 * zoom + sensitivity scaling + tighter accuracy, learnable per-weapon recoil
 * spray patterns, trauma-based screen shake, landing dip, and damage-number /
 * hitmarker feedback. Runs entirely in the r3f frame loop — no React re-renders.
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
import { computeDamage } from "../core/rules";
import { aimDir, clamp, distXZ } from "../core/vec";
import { AIR_INACCURACY, MOVE_INACCURACY, STILL_THRESHOLD, KNIFE_RANGE } from "../core/constants";
import { useGameStore } from "../state/store";
import { audio } from "../audio/engine";
import { weaponSoundId } from "../audio/types";
import { addShake, sampleShake } from "./camera-fx";
import { popDamage } from "./hud-fx";

const SLOT_KEYS: Record<string, "primary" | "secondary" | "melee" | "grenade"> = {
  Digit1: "primary",
  Digit2: "secondary",
  Digit3: "melee",
  Digit4: "grenade",
};

const SNIPER = "cucumber_cannon";

export function LocalController({ engine }: { engine: GameEngine }) {
  const { camera, gl } = useThree();
  const keys = useRef<Set<string>>(new Set());
  const mouseDown = useRef(false);
  const prevMouse = useRef(false);
  const ads = useRef(false);
  const baseYaw = useRef(0);
  const basePitch = useRef(0);
  const rYaw = useRef(0);
  const rPitch = useRef(0);
  const lastShot = useRef(0);
  const recoilIdx = useRef(0);
  const lastRecoilShot = useRef(0);
  const lastStep = useRef(0);
  const wantThrow = useRef(false);
  const prevGround = useRef(true);
  const fallVel = useRef(0);
  const landDip = useRef(0);

  // --- input listeners ------------------------------------------------------
  useEffect(() => {
    const me = engine.me;
    if (me) baseYaw.current = me.yaw;
    camera.rotation.order = "YXZ";
    const dom = gl.domElement;
    const ui = () => useGameStore.getState();

    const onKeyDown = (e: KeyboardEvent) => {
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
      if (e.code === "KeyR") {
        engine.reload();
        audio.play("reload_start");
      }
      if (e.code in SLOT_KEYS) switchToSlot(SLOT_KEYS[e.code]);
      if (e.code === "KeyG") wantThrow.current = true;
      if (e.code === "Escape") ui().setUi({ buyOpen: false });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      if (e.code === "Tab") ui().setUi({ scoreboard: false });
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseDown.current = true;
      if (e.button === 2) ads.current = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseDown.current = false;
      if (e.button === 2) ads.current = false;
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== dom) return;
      const s = ui().settings;
      const pc = camera as THREE.PerspectiveCamera;
      // slower aim when zoomed (scale by current FOV vs base)
      const zoom = pc.isPerspectiveCamera ? pc.fov / s.fov : 1;
      const k = 0.0022 * s.sensitivity * Math.max(0.35, zoom);
      baseYaw.current += e.movementX * k;
      const dy = e.movementY * k * (s.invertY ? -1 : 1);
      basePitch.current = clamp(basePitch.current - dy, -1.5, 1.5);
    };
    const onContext = (e: Event) => e.preventDefault();
    const onLockChange = () => {
      const locked = document.pointerLockElement === dom;
      ui().setUi({ pointerLocked: locked });
      if (!locked) {
        ads.current = false;
        if (!ui().buyOpen) ui().setUi({ paused: true });
      }
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

    // explosions near me shake the camera
    const offFx = engine.onFx((ev) => {
      const m = engine.me;
      if (!m) return;
      if (ev.k === "explode") {
        const d = distXZ(m.pos, ev.pos);
        if (d < 22) addShake(0.6 * (1 - d / 22));
      }
    });

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
      offFx();
    };
  }, [engine, camera, gl]);

  // --- per-frame loop -------------------------------------------------------
  useFrame((_, dt) => {
    const me = engine.me;
    if (!me) return;
    const store = useGameStore.getState();
    const active = store.pointerLocked && !store.buyOpen && !store.paused;
    const w = WEAPONS[me.currentWeapon];
    const cam = camera as THREE.PerspectiveCamera;

    // ---- ADS / zoom ----
    const canAds = active && me.alive && (w.slot === "primary" || w.slot === "secondary");
    const aiming = ads.current && canAds;
    const isSniper = me.currentWeapon === SNIPER;
    const baseFov = store.settings.fov;
    const targetFov = aiming ? baseFov * (isSniper ? 0.4 : 0.78) : baseFov;
    if (cam.isPerspectiveCamera) {
      cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 16);
      cam.updateProjectionMatrix();
    }
    const scoped = aiming && isSniper && cam.fov < baseFov * 0.62;
    if (store.scoped !== scoped) store.setUi({ scoped });

    // ---- recoil recovery ----
    const rec = mouseDown.current ? 0.95 : 0.84;
    rPitch.current *= rec;
    rYaw.current *= rec;

    const yaw = baseYaw.current + rYaw.current;
    const pitch = clamp(basePitch.current + rPitch.current, -1.5, 1.5);

    // ---- input ----
    const k = keys.current;
    const fwd = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const strafe = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    const input: PlayerInput = {
      move: active ? [strafe, fwd] : [0, 0],
      yaw,
      pitch,
      jump: active && k.has("Space"),
      crouch: active && (k.has("ControlLeft") || k.has("ControlRight") || k.has("KeyC")),
      walk: (active && k.has("ShiftLeft")) || aiming, // ADS steadies/slows you
      using: active && k.has("KeyE"),
      seq: 0,
      t: 0,
    };
    engine.setInput(input);

    // ---- landing dip ----
    if (!me.onGround) fallVel.current = me.vel[1];
    if (!prevGround.current && me.onGround) {
      const impact = Math.min(1, Math.abs(fallVel.current) / 12);
      if (impact > 0.15) {
        landDip.current = 0.14 * impact;
        addShake(0.18 * impact);
        audio.play("land", { volume: 0.35 + impact * 0.3 });
      }
    }
    prevGround.current = me.onGround;
    landDip.current *= 1 - Math.min(1, dt * 9);

    // ---- camera: position + look + shake ----
    const eye = eyePos(me);
    camera.position.set(eye[0], eye[1] - landDip.current, eye[2]);
    const sh = sampleShake(dt);
    camera.rotation.set(pitch + sh.pitch, -yaw + sh.yaw, sh.roll);

    // ---- footsteps ----
    const speed = Math.hypot(me.vel[0], me.vel[2]);
    if (me.alive && me.onGround && speed > 1.5 && !input.walk) {
      lastStep.current += dt;
      if (lastStep.current > 0.34) {
        lastStep.current = 0;
        audio.play("footstep", { volume: 0.5, rate: 0.9 + Math.random() * 0.2 });
      }
    }

    // ---- throw ----
    if (wantThrow.current) {
      wantThrow.current = false;
      tryThrow(me, eye, yaw, pitch);
    }

    // ---- shoot ----
    if (active && me.alive) handleFire(me, eye, yaw, pitch, aiming);
    prevMouse.current = mouseDown.current;
  });

  function tryThrow(me: PlayerState, eye: Vec3, yaw: number, pitch: number) {
    const nade = me.inventory.find((i) => WEAPONS[i.id].slot === "grenade");
    if (!nade) return;
    engine.throwNade({ weapon: nade.id, origin: eye, dir: aimDir(yaw, pitch), power: 0.8 });
    audio.play("nade_throw");
  }

  function handleFire(me: PlayerState, eye: Vec3, yaw: number, pitch: number, aiming: boolean) {
    const w = WEAPONS[me.currentWeapon];
    const isMelee = w.slot === "melee";
    if (w.slot === "grenade") {
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

    // ---- spread ----
    const speed = Math.hypot(me.vel[0], me.vel[2]);
    let spreadDeg = w.spread;
    if (speed > STILL_THRESHOLD) spreadDeg *= MOVE_INACCURACY * 0.5;
    if (!me.onGround) spreadDeg *= AIR_INACCURACY * 0.4;
    spreadDeg += me.bloom;
    if (aiming && speed < STILL_THRESHOLD) spreadDeg *= me.currentWeapon === SNIPER ? 0.06 : 0.4;
    spreadDeg = Math.min(spreadDeg, 14);
    const sd = (spreadDeg * Math.PI) / 180;

    const range = isMelee ? KNIFE_RANGE : w.range;
    const pellets = Math.max(1, w.pellets);
    const others = Object.values(engine.state.players);
    const boxes = getMap(engine.state.config.mapId).boxes;
    const hits: ShotMsg["hits"] = [];
    let firstDir = aimDir(yaw, pitch);
    let didHit = false;
    let headHit = false;
    let killed = false;
    let dmgSum = 0;
    for (let p = 0; p < pellets; p++) {
      const jy = yaw + (Math.random() - 0.5) * 2 * sd;
      const jp = clamp(pitch + (Math.random() - 0.5) * 2 * sd, -1.5, 1.5);
      const dir = aimDir(jy, jp);
      if (p === 0) firstDir = dir;
      const hit = raycastPlayers(eye, dir, range, others, me.id, 0.42, playerHeight(me), boxes);
      if (hit && hit.player.team !== me.team) {
        hits.push({ id: hit.player.id, headshot: hit.headshot, dist: hit.dist });
        const dr = computeDamage(me.currentWeapon, hit.dist, hit.headshot, hit.player.armor, hit.player.helmet);
        dmgSum += dr.hp;
        if (dr.hp >= hit.player.hp) killed = true;
        didHit = true;
        headHit = headHit || hit.headshot;
      }
    }

    engine.fire({ weapon: me.currentWeapon, origin: eye, dir: firstDir, hits });

    // ---- feedback ----
    audio.play(weaponSoundId(me.currentWeapon), { volume: 0.9 });
    if (didHit) {
      audio.play(killed ? "headshot" : headHit ? "headshot" : "hitmarker");
      popDamage({ amount: dmgSum, head: headHit, kill: killed });
    }
    addShake(0.01 + w.recoil * 0.0035);

    // ---- recoil pattern (climb + wiggle; learnable) ----
    if (now - lastRecoilShot.current > 250) recoilIdx.current = 0;
    recoilIdx.current++;
    lastRecoilShot.current = now;
    const climb = Math.min(1, recoilIdx.current / 7);
    rPitch.current += w.recoil * 0.0032 * (0.7 + climb);
    rYaw.current += Math.sin(recoilIdx.current * 1.7) * w.recoil * 0.0017;

    // optimistic ammo for clients (host authoritative; corrected by snapshot)
    if (engine.role === "client" && item && !isMelee) item.ammo = Math.max(0, item.ammo - 1);
  }

  return null;
}
