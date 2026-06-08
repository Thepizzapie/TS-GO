"use client";
/**
 * TOMATO STRIKE — PeerJS transport.
 *
 * Zero-backend networking: the host opens a PeerJS peer whose id encodes a short
 * room code; clients connect to that id over WebRTC (signaled by the free PeerJS
 * cloud broker). `createHostRoom` / `joinRoom` return the role-specific Transport
 * the GameEngine + lobby drive. Loaded dynamically so peerjs never touches SSR.
 */
import type { DataConnection } from "peerjs";
import type { ClientMsg, ClientTransport, HostMsg, HostTransport } from "./protocol";
import { PEER_PREFIX } from "./protocol";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L
function genCode(len = 4): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export async function createHostRoom(): Promise<{ transport: HostTransport; roomCode: string }> {
  const Peer = (await import("peerjs")).default;

  let peer: InstanceType<typeof Peer> | null = null;
  let roomCode = "";
  let lastErr = "";
  for (let attempt = 0; attempt < 6 && !peer; attempt++) {
    roomCode = genCode();
    const candidate = new Peer(PEER_PREFIX + roomCode);
    const result = await new Promise<"ok" | "retry" | "fatal">((resolve) => {
      const onOpen = () => {
        cleanup();
        resolve("ok");
      };
      const onErr = (e: { type?: string; message?: string }) => {
        cleanup();
        lastErr = e?.message || e?.type || "peer error";
        resolve(e?.type === "unavailable-id" ? "retry" : "fatal");
      };
      const cleanup = () => {
        candidate.off("open", onOpen);
        candidate.off("error", onErr);
      };
      candidate.on("open", onOpen);
      candidate.on("error", onErr);
    });
    if (result === "ok") peer = candidate;
    else {
      candidate.destroy();
      if (result === "fatal") break;
    }
  }
  if (!peer) throw new Error(lastErr ? `Couldn't open a room (${lastErr}).` : "Couldn't open a room. Try again.");
  const p = peer;

  const conns = new Map<string, DataConnection>();
  const h = {
    msg: (_pid: string, _m: ClientMsg) => {},
    join: (_pid: string) => {},
    leave: (_pid: string) => {},
  };

  p.on("connection", (conn) => {
    conn.on("open", () => {
      conns.set(conn.peer, conn);
      h.join(conn.peer);
    });
    conn.on("data", (d) => h.msg(conn.peer, d as ClientMsg));
    const drop = () => {
      if (conns.delete(conn.peer)) h.leave(conn.peer);
    };
    conn.on("close", drop);
    conn.on("error", drop);
  });
  // tolerate transient broker errors after the room is open
  p.on("error", () => {});

  const transport: HostTransport = {
    kind: "host",
    broadcast: (m: HostMsg) => {
      for (const c of conns.values()) if (c.open) c.send(m);
    },
    sendTo: (pid, m) => {
      const c = conns.get(pid);
      if (c && c.open) c.send(m);
    },
    onClientMessage: (cb) => (h.msg = cb),
    onClientJoin: (cb) => (h.join = cb),
    onClientLeave: (cb) => (h.leave = cb),
    close: () => {
      for (const c of conns.values()) c.close();
      p.destroy();
    },
  };
  return { transport, roomCode };
}

export async function joinRoom(code: string): Promise<ClientTransport> {
  const Peer = (await import("peerjs")).default;
  const peer = new Peer();

  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onErr = (e: { message?: string }) => {
      cleanup();
      reject(new Error(e?.message || "Couldn't reach the matchmaking broker."));
    };
    const cleanup = () => {
      peer.off("open", onOpen);
      peer.off("error", onErr);
    };
    peer.on("open", onOpen);
    peer.on("error", onErr);
  });

  const conn = peer.connect(PEER_PREFIX + code.toUpperCase().trim(), { reliable: true });
  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => {
      cleanup();
      reject(new Error("Room not found or the host is offline."));
    }, 12000);
    const onOpen = () => {
      clearTimeout(to);
      cleanup();
      resolve();
    };
    const onErr = () => {
      clearTimeout(to);
      cleanup();
      reject(new Error("Room not found or the host is offline."));
    };
    const cleanup = () => {
      conn.off("open", onOpen);
      peer.off("error", onErr);
    };
    conn.on("open", onOpen);
    peer.on("error", onErr);
  });

  // Buffer host messages until the lobby/engine attaches a handler, so the
  // `welcome` handshake (sent the instant we connect) is never dropped.
  const buffer: HostMsg[] = [];
  let handler: ((m: HostMsg) => void) | null = null;
  let closeCb: (r: string) => void = () => {};
  conn.on("data", (d) => {
    const m = d as HostMsg;
    if (handler) handler(m);
    else buffer.push(m);
  });
  conn.on("close", () => closeCb("Disconnected from host."));
  peer.on("error", () => closeCb("Connection error."));

  const transport: ClientTransport = {
    kind: "client",
    send: (m: ClientMsg) => {
      if (conn.open) conn.send(m);
    },
    onHostMessage: (cb) => {
      handler = cb;
      for (const m of buffer.splice(0)) cb(m);
    },
    onClose: (cb) => {
      closeCb = cb;
    },
    close: () => {
      conn.close();
      peer.destroy();
    },
  };
  return transport;
}
