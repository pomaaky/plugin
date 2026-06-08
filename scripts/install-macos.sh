#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ID="com.autopodcast.multicam"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/auto-podcast-multicam"
TARGET_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/$PLUGIN_ID"

if [[ ! -d "$SOURCE_DIR/CSXS" ]]; then
  echo "Errore: esegui lo script dalla repository o mantieni intatta la cartella auto-podcast-multicam." >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET_DIR")"
rm -rf "$TARGET_DIR"
cp -R "$SOURCE_DIR" "$TARGET_DIR"

# Permette a macOS/Premiere di caricare estensioni CEP non firmate durante sviluppo o installazione locale.
defaults write com.adobe.CSXS.9 PlayerDebugMode 1 || true
defaults write com.adobe.CSXS.10 PlayerDebugMode 1 || true
defaults write com.adobe.CSXS.11 PlayerDebugMode 1 || true
defaults write com.adobe.CSXS.12 PlayerDebugMode 1 || true

echo "Installato in: $TARGET_DIR"
echo "Riavvia Adobe Premiere Pro e apri: Finestra > Estensioni > Auto Podcast Multicam"
