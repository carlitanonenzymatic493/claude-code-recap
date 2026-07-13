import type { FC } from "react";
import { Composition } from "remotion";

import { Demo, DEMO_DURATION } from "./Demo";

// side effect: blocks the render until JetBrains Mono is actually loaded
import "./font";

export const RemotionRoot: FC = () => {
  return (
    <Composition
      id="Demo"
      component={Demo}
      durationInFrames={DEMO_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
