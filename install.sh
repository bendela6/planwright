#!/usr/bin/env bash
#
# Installs planwright as a Claude Code skill.
#
# By default, uses symlinks (dev install — changes in this repo are immediately
# active). Pass --copy to install by copying files instead (stable install).
#
# Usage:
#   ./install.sh              # Symlink install (recommended for development)
#   ./install.sh --copy       # Copy install (files are independent of repo)
#   ./install.sh --uninstall  # Remove the installed skill

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$HOME/.claude/skills/planwright"

MODE="symlink"
if [[ "${1:-}" == "--copy" ]]; then
  MODE="copy"
elif [[ "${1:-}" == "--uninstall" ]]; then
  MODE="uninstall"
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--copy|--uninstall]"
  exit 1
fi

if [[ "$MODE" == "uninstall" ]]; then
  if [[ -L "$SKILL_DIR" || -d "$SKILL_DIR" ]]; then
    echo "Removing $SKILL_DIR..."
    rm -rf "$SKILL_DIR"
    echo "Uninstalled planwright."
  else
    echo "planwright is not installed at $SKILL_DIR"
  fi
  exit 0
fi

# Refuse to overwrite an existing non-empty install without explicit removal
if [[ -L "$SKILL_DIR" ]]; then
  echo "Found existing symlink at $SKILL_DIR, removing..."
  rm "$SKILL_DIR"
elif [[ -d "$SKILL_DIR" ]]; then
  echo "Error: $SKILL_DIR already exists and is not a symlink."
  echo "Run '$0 --uninstall' first, or remove it manually."
  exit 1
fi

mkdir -p "$HOME/.claude/skills"

if [[ "$MODE" == "symlink" ]]; then
  ln -s "$SCRIPT_DIR" "$SKILL_DIR"
  echo "Symlinked $SKILL_DIR -> $SCRIPT_DIR"
else
  mkdir -p "$SKILL_DIR"
  cp "$SCRIPT_DIR/SKILL.md" "$SKILL_DIR/SKILL.md"
  cp -r "$SCRIPT_DIR/workflows" "$SKILL_DIR/workflows"
  cp -r "$SCRIPT_DIR/guidelines" "$SKILL_DIR/guidelines"
  cp -r "$SCRIPT_DIR/reviewer-app" "$SKILL_DIR/reviewer-app"
  echo "Copied skill files to $SKILL_DIR"
fi

# Install and build the reviewer app so it's ready to run on first invocation
if command -v pnpm >/dev/null 2>&1; then
  echo ""
  echo "Installing reviewer-app dependencies..."
  (cd "$SCRIPT_DIR/reviewer-app" && pnpm install --silent)
  echo "Reviewer app ready."
else
  echo ""
  echo "WARNING: pnpm not found on PATH. Install pnpm and then run:"
  echo "  cd $SCRIPT_DIR/reviewer-app && pnpm install"
fi

echo ""
echo "planwright installed successfully."
echo "Invoke with: /planwright new    or    /planwright audit"
