# video

Remotion source for the `claude-code-recap` demo video. Rendering this project
produces the two artifacts the top level README embeds:

| Artifact            | Size            | Notes                                  |
| ------------------- | --------------- | -------------------------------------- |
| `../assets/demo.mp4` | 1920x1080, 30fps | h264, full quality, linked from the README |
| `../assets/demo.gif` | 960x540, 15fps  | embedded inline in the README          |

The video is 780 frames, 26 seconds at 30fps.

## Prerequisites

Node 22 or 24 LTS. **Do not use Node 26**: Remotion's browser fetcher depends on
`extract-zip`, which breaks on Node 26, so Chrome Headless Shell is never
extracted and the render dies quietly with no useful error. An `.nvmrc` pinning
24 is included.

```sh
nvm use
npm install
npx remotion browser ensure   # downloads Chrome Headless Shell (~94 MB), once
```

`browser ensure` is optional but worth running first. Remotion downloads the
browser on the first render otherwise, and a silent 94 MB download in the middle
of a render looks exactly like a hang.

## Preview

```sh
npm run dev        # opens Remotion Studio, scrub the timeline
```

## Render

```sh
npm run build      # both artifacts
npm run render:mp4 # 1920x1080 h264  -> ../assets/demo.mp4
npm run render:gif # 960x540 15fps   -> ../assets/demo.gif
```

Both scripts write **outside** this directory, into `../assets/`. That is
deliberate: `out/` is in `.gitignore`, so anything rendered there could never be
committed, and the whole point of the artifacts is to be committed and embedded.

To check what you actually produced:

```sh
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate,nb_frames \
  -of default=nw=1 ../assets/demo.gif
```

## Structure

```
src/
  index.ts             registerRoot
  Root.tsx             the single "Demo" composition, 1920x1080, 30fps, 780 frames
  Demo.tsx             scene layout and the cross dissolves between beats
  theme.ts             palette, easing curves, terminal metrics
  font.ts              JetBrains Mono, loaded from disk
  spans.ts             the span model for coloured terminal output
  data.ts              the demo transcript and every beat's timing
  components/Term.tsx  typed line, output line, cursor, span runner
  components/Window.tsx window chrome and the tab strip
  scenes/              ColdOpen, TerminalScene, EndCard
public/fonts/          JetBrains Mono woff2 (OFL, license included)
```

Beats: cold open (0.0s to 4.4s), the `/recap` command typed out, the listing
building in line by line (the long beat, it holds for three full seconds so it
can actually be read), `--open` with the tabs materialising, then the end card.

### Where the numbers come from

`data.ts` is not eyeballed. Every line is built with the same formulas
`skills/recap/recap.py` uses in `render()` (the gap before the session id, the
day rule widths, the header padding), and the project dot colours are the ones
`proj_color()` actually picks for those paths. The sessions themselves are
invented: generic project names, invented UUIDs, a `~` relative home.

## Things that will bite you if you change this

**Do not put codec options in `remotion.config.ts`.** The config file applies to
every render regardless of codec. A `Config.setCrf()` there makes every GIF
render fail with `The "gif" codec does not support the --crf option`. Codec
specific flags belong on the CLI, which is where the package scripts put them.

**Do not switch the font to `@remotion/google-fonts`.** It fetches
fonts.gstatic.com at render time with an 18 second timeout, so the render stops
being offline or deterministic. The woff2 files are committed under
`public/fonts/` and loaded with `@remotion/fonts`.

**Keep the full JetBrains Mono, not a subset.** The fontsource "latin" subset is
229 codepoints and is missing every non-ASCII glyph recap prints (`─ ● ◆ ▁ █
≈`), which renders the entire listing as tofu boxes. The committed files are the
full webfont, 1363 codepoints. The one glyph no JetBrains Mono ships at all is
`⎇` (U+2387, the branch mark), so that is drawn as an inline SVG in `Term.tsx`.

**Never remove the ligature reset.** JetBrains Mono fuses `--` into a single long
dash glyph, so `--since` renders on screen as a dash and no longer shows the flag
the user actually types. `termText` in `Term.tsx` sets `fontVariantLigatures:
"none"` and `fontFeatureSettings: '"liga" 0, "calt" 0'` to stop it.

**Terminal width is 112 columns for a reason.** recap's footer hint line is 111
characters. Anything narrower hard wraps it mid word and it reads as a typo.

**Animation must be a pure function of the frame.** Remotion renders frames out
of order and in parallel, so `useState` or `setInterval` driven animation
produces corrupted, nondeterministic output. The typing reveal and the scroll
offset are both computed from `useCurrentFrame()` alone.

Tailwind is intentionally absent. `create-video --blank` installs it even when
you pass `--no-tailwind` (the flag is ignored in 4.0.489), so it was stripped.
