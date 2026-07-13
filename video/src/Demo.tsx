import type { FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";

import { ColdOpen, COLD_OPEN_DUR } from "./scenes/ColdOpen";
import { EndCard, END_CARD_DUR } from "./scenes/EndCard";
import { TerminalScene } from "./scenes/TerminalScene";
import { T } from "./data";
import { claude } from "./theme";

/**
 * Scene layout, 30fps.
 *
 * The scenes overlap by design: each one fades itself in and out, so the cuts
 * are cross dissolves against a background that never moves. There is no hard
 * cut and nothing slides across the frame.
 */
export const COLD_OPEN_AT = 0;
export const TERMINAL_AT = 120; // starts while the cold open is still fading
export const END_CARD_AT = TERMINAL_AT + T.end - 12; // 618
export const DEMO_DURATION = END_CARD_AT + END_CARD_DUR; // 780 = 26s

export const Demo: FC = () => (
  <AbsoluteFill style={{ background: claude.frame }}>
    {/* one static, very low contrast wash so the window has something to sit on */}
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(1200px 700px at 50% 45%, rgba(217, 119, 87, 0.055), rgba(217, 119, 87, 0) 70%)",
      }}
    />

    <Sequence from={COLD_OPEN_AT} durationInFrames={COLD_OPEN_DUR}>
      <ColdOpen />
    </Sequence>

    <Sequence from={TERMINAL_AT} durationInFrames={T.end}>
      <TerminalScene />
    </Sequence>

    <Sequence from={END_CARD_AT} durationInFrames={END_CARD_DUR}>
      <EndCard />
    </Sequence>
  </AbsoluteFill>
);
