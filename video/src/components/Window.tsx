import type { FC, ReactNode } from "react";
import { Easing, interpolate } from "remotion";

import { MONO } from "../font";
import { SESSIONS } from "../data";
import {
  claude,
  ansi,
  easing,
  PAD_X,
  PAD_Y,
  TITLEBAR_H,
  VIEWPORT_H,
  WINDOW_H,
  WINDOW_W,
} from "../theme";

const Dot: FC<{ color: string; size?: number }> = ({ color, size = 12 }) => (
  <span
    style={{
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: size / 2,
      background: color,
    }}
  />
);

/**
 * One terminal tab. `--open` writes a resume command into a new tab per
 * session, so each tab is labelled with its project and carries that project's
 * dot, the same dot the listing drew.
 */
const Tab: FC<{
  label: string;
  dot: string;
  t: number;
  active: boolean;
}> = ({ label, dot, t, active }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 9,
      height: 34,
      padding: "0 16px",
      borderRadius: 8,
      background: active ? claude.panelHi : "transparent",
      border: `1px solid ${active ? claude.border : "transparent"}`,
      opacity: t,
      transform: `translateY(${interpolate(t, [0, 1], [6, 0])}px)`,
    }}
  >
    <Dot color={dot} size={8} />
    <span
      style={{
        fontFamily: MONO,
        fontSize: 19,
        color: active ? claude.text : ansi.mut,
        fontVariantLigatures: "none",
        fontFeatureSettings: '"liga" 0, "calt" 0',
      }}
    >
      {label}
    </span>
  </div>
);

export const Window: FC<{
  sceneFrame: number;
  /** null until `--open` runs */
  tabs: { start: number; stagger: number; dur: number } | null;
  children: ReactNode;
}> = ({ sceneFrame, tabs, children }) => {
  // the window title crossfades out as the tabs arrive, in place
  const titleOut = tabs
    ? interpolate(sceneFrame, [tabs.start, tabs.start + 10], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  return (
    <div
      style={{
        width: WINDOW_W,
        height: WINDOW_H,
        borderRadius: 14,
        background: claude.bg,
        border: `1px solid ${claude.border}`,
        boxShadow: "0 40px 90px rgba(0, 0, 0, 0.55)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* title bar */}
      <div
        style={{
          position: "relative",
          height: TITLEBAR_H,
          flexShrink: 0,
          background: claude.panel,
          borderBottom: `1px solid ${claude.border}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: 18,
          paddingRight: 18,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Dot color="#3a3a37" />
          <Dot color="#3a3a37" />
          <Dot color="#3a3a37" />
        </div>

        {/* centred title, present until the tabs replace it */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 19,
            color: ansi.mut,
            opacity: titleOut,
          }}
        >
          recap
        </div>

        {/* tabs materialise in place of the title */}
        {tabs ? (
          <div
            style={{
              position: "absolute",
              left: 92,
              right: 18,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            {SESSIONS.map((s, i) => {
              const start = tabs.start + i * tabs.stagger;
              const t = interpolate(
                sceneFrame,
                [start, start + tabs.dur],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(...easing.out),
                },
              );
              return (
                <Tab
                  key={s.sid}
                  label={s.path.replace("~/repos/", "")}
                  dot={s.dot}
                  t={t}
                  active={i === 0}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      {/* pane */}
      <div
        style={{
          flex: 1,
          padding: `${PAD_Y}px ${PAD_X}px`,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/*
          The scrollback is clipped to its own viewport box, not to the pane.
          Without this the buffer scrolls up into the pane's padding and lines
          get sliced in half against the title bar. The mask softens the top
          edge so a line leaving the buffer dissolves instead of being guillotined.
        */}
        <div
          style={{
            height: VIEWPORT_H,
            overflow: "hidden",
            maskImage: "linear-gradient(to bottom, transparent 0, #000 20px)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0, #000 20px)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
