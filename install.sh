#!/bin/sh
# install.sh: install the recap skill for Claude Code.
#
#   curl -fsSL https://raw.githubusercontent.com/noluyorAbi/claude-code-recap/main/install.sh | sh
#
# Copies skills/recap into $CLAUDE_CONFIG_DIR/skills/recap (default ~/.claude/skills/recap).
# Works from a git checkout and from a curl pipe, where $0 is not a usable path
# and the skill files are fetched from GitHub instead.
#
# Flags:
#   --force      overwrite an existing install, even if it was modified locally
#   --uninstall  remove the files this script installed
#   --help       show usage
#
# Env:
#   CLAUDE_CONFIG_DIR   Claude Code config dir (default: $HOME/.claude)
#   RECAP_REF           git ref to fetch when running from a pipe (default: main)
#   RECAP_TARBALL       full tarball URL, overrides REPO/REF (used by the tests)

set -eu

REPO="noluyorAbi/claude-code-recap"
REF="${RECAP_REF:-main}"
SKILL_NAME="recap"
MANIFEST_NAME=".claude-code-recap-manifest.json"
TRACKED="SKILL.md recap.py"

FORCE=0
UNINSTALL=0
TMPDIR_SELF=""

usage() {
  cat <<'EOF'
install.sh: install the recap skill for Claude Code.

Usage:
  ./install.sh [--force] [--uninstall]
  curl -fsSL https://raw.githubusercontent.com/noluyorAbi/claude-code-recap/main/install.sh | sh

Options:
  --force      overwrite an existing install, even if it has local edits
  --uninstall  remove the files this script installed
  -h, --help   show this help

Environment:
  CLAUDE_CONFIG_DIR  Claude Code config dir (default: $HOME/.claude)
  RECAP_REF          git ref fetched when piped from curl (default: main)
EOF
}

die() {
  printf 'install.sh: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  if [ -n "$TMPDIR_SELF" ] && [ -d "$TMPDIR_SELF" ]; then
    rm -rf "$TMPDIR_SELF"
  fi
}
trap cleanup EXIT HUP INT TERM

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --uninstall) UNINSTALL=1 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'install.sh: unknown option: %s\n\n' "$arg" >&2; usage >&2; exit 2 ;;
  esac
done

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
DEST="$CONFIG_DIR/skills/$SKILL_NAME"
MANIFEST="$DEST/$MANIFEST_NAME"

sha256() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    die "need shasum or sha256sum to verify installed files"
  fi
}

# Emit "<relative-path> <sha256>" for every file recorded in the manifest.
manifest_entries() {
  sed -n '/"files"[[:space:]]*:/,/}/p' "$1" |
    sed -n 's/^[[:space:]]*"\([^"]*\)"[[:space:]]*:[[:space:]]*"\([0-9a-f]\{64\}\)".*/\1 \2/p'
}

# Print every tracked file whose content no longer matches the manifest.
modified_files() {
  [ -f "$MANIFEST" ] || return 0
  manifest_entries "$MANIFEST" | while read -r rel recorded; do
    [ -f "$DEST/$rel" ] || continue
    if [ "$(sha256 "$DEST/$rel")" != "$recorded" ]; then
      printf '%s\n' "$rel"
    fi
  done
}

skill_version() {
  sed -n 's/^[[:space:]]\{1,\}version:[[:space:]]*"\{0,1\}\([0-9][0-9A-Za-z.+-]*\)"\{0,1\}[[:space:]]*$/\1/p' "$1" |
    head -n 1
}

# ---------- uninstall ----------
if [ "$UNINSTALL" -eq 1 ]; then
  if [ ! -d "$DEST" ]; then
    printf 'recap is not installed (%s does not exist).\n' "$DEST"
    exit 0
  fi

  if [ ! -f "$MANIFEST" ]; then
    if [ "$FORCE" -ne 1 ]; then
      printf 'install.sh: %s exists but was not installed by this script (no manifest).\n' "$DEST" >&2
      printf 'Refusing to remove it. Re-run with --force to delete it anyway.\n' >&2
      exit 1
    fi
    rm -rf "$DEST"
    printf 'Removed %s (forced, no manifest).\n' "$DEST"
    exit 0
  fi

  changed="$(modified_files)"
  if [ -n "$changed" ] && [ "$FORCE" -ne 1 ]; then
    printf 'install.sh: these installed files have local edits:\n' >&2
    printf '%s\n' "$changed" | sed 's/^/  /' >&2
    printf 'Refusing to delete them. Back them up, then re-run with --force.\n' >&2
    exit 1
  fi

  manifest_entries "$MANIFEST" | while read -r rel _hash; do
    rm -f "$DEST/$rel"
  done
  rm -f "$MANIFEST"
  # Prune empty directories bottom-up, including DEST itself when nothing is left.
  find "$DEST" -depth -type d -empty -exec rmdir {} + 2>/dev/null || true

  if [ -d "$DEST" ]; then
    printf 'Removed the recap skill files from %s.\n' "$DEST"
    printf 'Kept the directory: it still contains files this script did not install.\n'
  else
    printf 'Removed %s.\n' "$DEST"
  fi
  exit 0
fi

# ---------- locate the skill source ----------
SRC=""
SCRIPT_DIR=""
case "${0:-}" in
  ''|sh|-sh|bash|-bash|dash|-dash|zsh|-zsh) : ;;
  *)
    if [ -f "$0" ]; then
      SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
    fi
    ;;
esac

if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/skills/$SKILL_NAME/SKILL.md" ]; then
  SRC="$SCRIPT_DIR/skills/$SKILL_NAME"
else
  # Curl pipe: no local checkout, fetch the tarball.
  command -v curl >/dev/null 2>&1 || die "curl is required to fetch the skill"
  command -v tar >/dev/null 2>&1 || die "tar is required to unpack the skill"
  TMPDIR_SELF="$(mktemp -d 2>/dev/null || mktemp -d -t recap)"
  TARBALL="${RECAP_TARBALL:-https://codeload.github.com/$REPO/tar.gz/$REF}"
  printf 'Fetching %s@%s ...\n' "$REPO" "$REF"
  curl -fsSL --retry 2 -o "$TMPDIR_SELF/src.tar.gz" "$TARBALL" ||
    die "could not download $TARBALL"
  tar -xzf "$TMPDIR_SELF/src.tar.gz" -C "$TMPDIR_SELF" ||
    die "could not unpack the archive downloaded from $TARBALL"
  SRC="$(find "$TMPDIR_SELF" -type d -path "*/skills/$SKILL_NAME" | head -n 1)"
  [ -n "$SRC" ] || die "downloaded archive does not contain skills/$SKILL_NAME"
fi

[ -f "$SRC/SKILL.md" ] || die "missing $SRC/SKILL.md"
[ -f "$SRC/recap.py" ] || die "missing $SRC/recap.py"

# The Agent Skills spec requires SKILL.md `name` to equal the directory name.
DECLARED="$(sed -n 's/^name:[[:space:]]*\([a-z0-9][a-z0-9-]*\)[[:space:]]*$/\1/p' "$SRC/SKILL.md" | head -n 1)"
[ "$DECLARED" = "$SKILL_NAME" ] ||
  die "SKILL.md declares name '$DECLARED' but must declare '$SKILL_NAME'"

VERSION="$(skill_version "$SRC/SKILL.md")"
[ -n "$VERSION" ] || VERSION="unknown"

# ---------- guard an existing install ----------
if [ -d "$DEST" ]; then
  if [ -f "$MANIFEST" ]; then
    changed="$(modified_files)"
    if [ -n "$changed" ] && [ "$FORCE" -ne 1 ]; then
      printf 'install.sh: these installed files have local edits:\n' >&2
      printf '%s\n' "$changed" | sed 's/^/  /' >&2
      printf 'Refusing to overwrite them. Back them up, then re-run with --force.\n' >&2
      exit 1
    fi
    manifest_entries "$MANIFEST" | while read -r rel _hash; do
      rm -f "$DEST/$rel"
    done
    rm -f "$MANIFEST"
  elif [ "$FORCE" -ne 1 ]; then
    printf 'install.sh: %s already exists and was not installed by this script.\n' "$DEST" >&2
    printf 'Refusing to overwrite it. Move it aside, or re-run with --force.\n' >&2
    exit 1
  fi
fi

# ---------- install ----------
mkdir -p "$DEST"
cp "$SRC/SKILL.md" "$DEST/SKILL.md"
cp "$SRC/recap.py" "$DEST/recap.py"
chmod 0644 "$DEST/SKILL.md"
chmod 0755 "$DEST/recap.py"

SKILL_SHA="$(sha256 "$DEST/SKILL.md")"
RECAP_SHA="$(sha256 "$DEST/recap.py")"
NOW="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

{
  printf '{\n'
  printf '  "tool": "claude-code-recap",\n'
  printf '  "version": "%s",\n' "$VERSION"
  printf '  "installedAt": "%s",\n' "$NOW"
  printf '  "files": {\n'
  printf '    "SKILL.md": "%s",\n' "$SKILL_SHA"
  printf '    "recap.py": "%s"\n' "$RECAP_SHA"
  printf '  }\n'
  printf '}\n'
} >"$MANIFEST"

printf '\nInstalled the recap skill (v%s).\n' "$VERSION"
printf '  %s\n' "$DEST/SKILL.md"
printf '  %s\n' "$DEST/recap.py"
printf '\nClaude Code picks up %s/skills without a restart.\n' "$CONFIG_DIR"
printf 'Restart it only if that directory did not exist when the session started.\n'
printf '\nRun it with:  /recap\n'
printf 'Or directly:  python3 %s\n' "$DEST/recap.py"
printf 'Uninstall:    ./install.sh --uninstall\n'

if ! command -v python3 >/dev/null 2>&1; then
  printf '\nWarning: python3 was not found on PATH. The skill needs Python 3 to run.\n' >&2
fi

for rel in $TRACKED; do
  [ -f "$DEST/$rel" ] || die "post-install check failed: $DEST/$rel is missing"
done
