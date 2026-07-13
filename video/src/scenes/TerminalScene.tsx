import type { FC } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { Window } from "../components/Window";
import { OutLine, TypedLine } from "../components/Term";
import { rowOffsets, T, TRANSCRIPT } from "../data";
import { easing, TERM, VIEWPORT_H } from "../theme";

const target = (rows: number): number =>
  Math.max(0, rows * TERM.lineHeight - VIEWPORT_H);

/**
 * The pane scrolls the way a terminal scrolls: content grows downward, and once
 * it passes the bottom of the viewport the whole buffer slides up. This is what
 * lets the type stay large (28px) instead of being shrunk to fit 30 lines.
 *
 * The offset is a pure function of the frame. For the most recently revealed
 * line we ease from the previous scroll target to the new one, so the buffer
 * glides rather than jumping a row at a time.
 */
const scrollOffset = (sceneFrame: number): number => {
  let k = -1;
  for (let i = 0; i < TRANSCRIPT.length; i++) {
    if (TRANSCRIPT[i].from <= sceneFrame) {
      k = i;
    }
  }
  if (k < 0) {
    return 0;
  }
  const rowsAfter = (i: number): number =>
    rowOffsets[i] + (TRANSCRIPT[i].rows ?? 1);

  const from = k > 0 ? target(rowsAfter(k - 1)) : 0;
  const to = target(rowsAfter(k));
  if (from === to) {
    return to;
  }
  const t = interpolate(sceneFrame, [TRANSCRIPT[k].from, TRANSCRIPT[k].from + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing.out),
  });
  return interpolate(t, [0, 1], [from, to]);
};

export const TerminalScene: FC = () => {
  const sceneFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // window enters: opacity plus an 8px lift. 10 frames (333ms), ease-out.
  const enter = interpolate(sceneFrame, [T.windowIn, T.windowIn + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing.out),
  });
  const leave = interpolate(sceneFrame, [T.end - 16, T.end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scroll = scrollOffset(sceneFrame);
  const tabs =
    sceneFrame >= T.tabsStart
      ? { start: T.tabsStart, stagger: T.tabStagger, dur: T.tabDur }
      : null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: enter * leave,
        transform: `translateY(${interpolate(enter, [0, 1], [8, 0])}px)`,
      }}
    >
      <Window sceneFrame={sceneFrame} tabs={tabs}>
        <div style={{ transform: `translateY(${-scroll}px)` }}>
          {TRANSCRIPT.map((line) =>
            line.kind === "typed" ? (
              <TypedLine
                key={line.key}
                spans={line.spans}
                sceneFrame={sceneFrame}
                from={line.from}
                typeAt={line.typeAt ?? line.from}
                cps={line.cps ?? 16}
                fps={fps}
                submitAt={line.submitAt ?? Number.MAX_SAFE_INTEGER}
              />
            ) : (
              <OutLine
                key={line.key}
                spans={line.spans}
                sceneFrame={sceneFrame}
                from={line.from}
                rows={line.rows ?? 1}
                wrap={line.wrap ?? false}
              />
            ),
          )}
        </div>
      </Window>
    </AbsoluteFill>
  );
};
