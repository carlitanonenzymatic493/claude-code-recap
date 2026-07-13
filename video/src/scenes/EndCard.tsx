import type { FC, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { MONO } from "../font";
import { ansi, claude, easing } from "../theme";

export const END_CARD_DUR = 162;

const mono = {
  fontFamily: MONO,
  fontVariantLigatures: "none",
  fontFeatureSettings: '"liga" 0, "calt" 0',
  whiteSpace: "pre",
} as const;

/** Entrances only, staggered. The frame then holds, completely still. */
const Row: FC<{ frame: number; at: number; children: ReactNode }> = ({
  frame,
  at,
  children,
}) => {
  const t = interpolate(frame, [at, at + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing.out),
  });
  return (
    <div
      style={{
        opacity: t,
        transform: `translateY(${interpolate(t, [0, 1], [8, 0])}px)`,
      }}
    >
      {children}
    </div>
  );
};

export const EndCard: FC = () => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: t,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
        }}
      >
        <Row frame={frame} at={6}>
          <div style={{ ...mono, fontSize: 64, fontWeight: 700, color: claude.bright }}>
            <span style={{ color: claude.clay }}>◆</span> recap
          </div>
        </Row>

        <Row frame={frame} at={16}>
          <div style={{ ...mono, fontSize: 28, color: claude.dim }}>
            Get back into every session.
          </div>
        </Row>

        <Row frame={frame} at={28}>
          <div
            style={{
              ...mono,
              fontSize: 30,
              color: claude.text,
              background: claude.panel,
              border: `1px solid ${claude.border}`,
              borderRadius: 10,
              padding: "16px 28px",
              marginTop: 12,
            }}
          >
            <span style={{ color: claude.clay }}>$</span> npx claude-code-recap
          </div>
        </Row>

        <Row frame={frame} at={40}>
          <div style={{ ...mono, fontSize: 24, color: ansi.mut, marginTop: 4 }}>
            github.com/noluyorAbi/claude-code-recap
          </div>
        </Row>
      </div>
    </AbsoluteFill>
  );
};
