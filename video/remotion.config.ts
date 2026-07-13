/**
 * Remotion config.
 *
 * Keep this file CODEC-AGNOSTIC. It applies to every render regardless of the
 * codec, so a codec-specific option set here breaks the other codec. Putting
 * Config.setCrf() or Config.setPixelFormat() in this file makes every GIF
 * render die with:
 *
 *   TypeError: The "gif" codec does not support the --crf option.
 *
 * Pass codec-specific flags on the CLI instead (see the package.json scripts).
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
