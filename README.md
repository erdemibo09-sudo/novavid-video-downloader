# ⚡ NovaVid — Ultra HD Video Downloader & Converter

<div align="center">

![NovaVid Banner](https://img.shields.io/badge/NovaVid-v1.0.0-6366f1?style=for-the-badge&logo=youtube&logoColor=white)
![Build Status](https://img.shields.io/badge/Build-Passing-10b981?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078d4?style=for-the-badge&logo=windows)
![Engine](https://img.shields.io/badge/Engine-yt--dlp%20%2B%20FFmpeg-f59e0b?style=for-the-badge)
![Runtime](https://img.shields.io/badge/Runtime-Deno-black?style=for-the-badge&logo=deno)
![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)

**A high-performance, privacy-first desktop application to download 4K/1080p videos and extract 320kbps audio from YouTube, Instagram, TikTok, X, and 1000+ sites.**

[Features](#-key-features) • [Installation](#-quick-start) • [Architecture](#-architecture) • [Keyboard Shortcuts](#-keyboard-shortcuts)

</div>

---

## ✨ Key Features

- **🎬 Ultra HD & 4K Downloads:** Download up to 4K (2160p), 2K (1440p), 1080p Full HD at 60fps with automatic lossless FFmpeg audio/video muxing.
- **🎵 Studio Audio Extraction:** One-click conversion to MP3 (320 kbps), lossless WAV, and AAC/M4A.
- **🛡️ Built-in Anti-Bot Bypass:** Automatic Deno JS-runtime challenge solving and browser session integration to bypass YouTube's *"Sign in to confirm you're not a bot"* lock.
- **⚡ Live Real-Time Telemetry:** Instant Server-Sent Events (SSE) streaming progress, download speed (MB/s), ETA timer, and byte counters.
- **🔄 Local Media Converter:** Drag-and-drop any video/audio file (MKV, AVI, MOV, WebM, FLAC) to convert, resize, or compress locally.
- **📦 Batch Queue:** Paste multiple links at once for uninterrupted sequential downloads.
- **📂 One-Click Explorer & Playback:** Reveal files directly in Windows Explorer or play them in your default media player with zero path-escaping bugs.
- **🔒 100% Local & Private:** Zero third-party web tracking, zero cloud proxying. All downloads stay exclusively on your local machine and are ignored by `.gitignore`.

---

## 🚀 Quick Start

### 1. Requirements
- Windows 10 or Windows 11
- [yt-dlp](https://github.com/yt-dlp/yt-dlp), [FFmpeg](https://ffmpeg.org/), and [Deno](https://deno.com/) *(automatically detected from WinGet or system PATH)*

### 2. Launching NovaVid
Double-click **`Start.bat`** (or `NovaVid.lnk` on your Desktop).

The background server will initialize, and NovaVid will automatically open in a native desktop window:
```text
🌐 Web UI: http://localhost:3000
📁 Downloads: .\downloads
⚡ yt-dlp: Enabled (Nightly)
🎬 FFmpeg: Enabled
🦕 Deno: Enabled (JS Solver)
🍪 Browser Auth: Enabled
```

---

## 🛠️ Architecture

NovaVid is architected for zero-bloat performance:

```mermaid
graph LR
    UI[NovaVid Desktop UI] <-->|REST API + SSE Stream| Server[Local Deno Server :3000]
    Server -->|Signatures & Extraction| DenoJS[Deno JS Solver]
    Server -->|Streams & Formats| YTDLP[yt-dlp Engine]
    Server -->|Muxing & Encoding| FFmpeg[FFmpeg Binary]
    FFmpeg --> Output[(./downloads/)]
```

---

## ⌨️ Shortcuts & Tips

| Action | Shortcut |
| :--- | :--- |
| **Instant Paste & Inspect** | Click `Paste` (`Yapıştır`) button |
| **Quick Download** | Press `Enter` in the URL field |
| **Open Library** | Click `Downloads & Library` tab |
| **Reveal in Folder** | Click `Show in Folder` on any file |
| **Play File** | Click `▶ Play` on any file |

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
