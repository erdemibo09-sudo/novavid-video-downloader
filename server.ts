// NovaVid - Ultra HD Video Downloader & Converter (Deno Backend - Zero Dependencies)

const PORT = 3000;
const ROOT_DIR = Deno.cwd();
const PUBLIC_DIR = `${ROOT_DIR}\\public`;

// Windows uyumluluğu için temiz downloads yolu (Türkçe karakter ve Explorer takılmalarını önler)
const userProfile = Deno.env.get("USERPROFILE") || "";
let DOWNLOADS_DIR = `${ROOT_DIR}\\downloads`;
if (userProfile) {
  const novaVidPath = `${userProfile}\\Desktop\\NovaVid\\downloads`;
  try {
    if (Deno.statSync(novaVidPath).isDirectory) {
      DOWNLOADS_DIR = novaVidPath;
    }
  } catch {
    // fallback to ROOT_DIR\\downloads
  }
}

// MIME türleri sözlüğü
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
};

// Statik dosya sunucu (Tamamen yerel ve bağımsız)
async function serveStaticFile(reqPath: string): Promise<Response> {
  try {
    let cleanPath = reqPath.split("?")[0];
    if (cleanPath === "/" || cleanPath === "") {
      cleanPath = "/index.html";
    }
    const safePath = cleanPath.replace(/^\/+/, "").replace(/\//g, "\\");
    const filePath = `${PUBLIC_DIR}\\${safePath}`;

    const stat = await Deno.stat(filePath);
    if (!stat.isFile) {
      return new Response("Bulunamadı", { status: 404 });
    }

    const file = await Deno.readFile(filePath);
    const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response("Dosya bulunamadı", { status: 404 });
  }
}

// yt-dlp ve ffmpeg yollarını tespit et
function findExecutablePaths() {
  const localAppData = Deno.env.get("LOCALAPPDATA") || "";

  const ytCandidates = [
    `${localAppData}\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\yt-dlp.exe`,
    `${localAppData}\\Microsoft\\WinGet\\Links\\yt-dlp.exe`,
    "yt-dlp.exe",
    "yt-dlp",
  ];

  let ytDlpPath = "yt-dlp";
  for (const candidate of ytCandidates) {
    try {
      if (candidate.includes("\\")) {
        const stat = Deno.statSync(candidate);
        if (stat.isFile) {
          ytDlpPath = candidate;
          break;
        }
      }
    } catch {
      // devam et
    }
  }

  const ffmpegCandidates = [
    `${localAppData}\\Microsoft\\WinGet\\Packages\\yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-N-126374-g089a48eb36-win64-gpl\\bin\\ffmpeg.exe`,
    `${localAppData}\\Microsoft\\WinGet\\Links\\ffmpeg.exe`,
    "ffmpeg.exe",
    "ffmpeg",
  ];

  let ffmpegPath = "ffmpeg";
  let ffmpegBinDir = "";
  for (const candidate of ffmpegCandidates) {
    try {
      if (candidate.includes("\\")) {
        const stat = Deno.statSync(candidate);
        if (stat.isFile) {
          ffmpegPath = candidate;
          ffmpegBinDir = candidate.substring(0, candidate.lastIndexOf("\\"));
          break;
        }
      }
    } catch {
      // devam et
    }
  }

  const denoPath = Deno.execPath();
  const denoDir = denoPath.substring(0, denoPath.lastIndexOf("\\"));

  return { ytDlpPath, ffmpegPath, ffmpegBinDir, denoPath, denoDir };
}

function detectCookieBrowser(): string | null {
  try {
    const appData = Deno.env.get("APPDATA") || "";
    if (appData) {
      const ffProfilesDir = `${appData}\\Mozilla\\Firefox\\Profiles`;
      try {
        for (const entry of Deno.readDirSync(ffProfilesDir)) {
          if (entry.isDirectory) {
            const cookieFile = `${ffProfilesDir}\\${entry.name}\\cookies.sqlite`;
            try {
              if (Deno.statSync(cookieFile).isFile) {
                return "firefox";
              }
            } catch {
              // devam
            }
          }
        }
      } catch {
        // devam
      }
    }
  } catch {
    // devam
  }
  return null;
}

const { ytDlpPath, ffmpegPath, ffmpegBinDir, denoPath, denoDir } = findExecutablePaths();
const cookieBrowser = detectCookieBrowser();

const sysPath = Deno.env.get("PATH") || "";
const augmentedPath = [denoDir, ffmpegBinDir, sysPath].filter(Boolean).join(";");

console.log("=========================================");
console.log("🚀 NovaVid - Ultra HD Video Downloader & Converter");
console.log(`🌐 Web UI: http://localhost:${PORT}`);
console.log(`📁 Downloads: ${DOWNLOADS_DIR}`);
console.log(`⚡ yt-dlp: ${ytDlpPath}`);
console.log(`🎬 ffmpeg: ${ffmpegPath}`);
console.log(`🦕 deno: ${denoPath}`);
console.log(`🍪 Browser Auth: ${cookieBrowser ? cookieBrowser : "None"}`);
console.log("=========================================");

// İndirilenler klasörünü oluştur
try {
  Deno.mkdirSync(DOWNLOADS_DIR, { recursive: true });
} catch {
  // zaten var
}

interface ActiveJob {
  id: string;
  type: "download" | "convert";
  url?: string;
  title: string;
  thumbnail?: string;
  formatType: string;
  quality: string;
  percent: number;
  speed: string;
  eta: string;
  downloadedBytes: string;
  totalBytes: string;
  status: "starting" | "downloading" | "merging" | "extracting" | "converting" | "completed" | "error" | "cancelled";
  outputFile?: string;
  error?: string;
  process?: Deno.ChildProcess;
  listeners: Set<(data: string) => void>;
}

const jobs = new Map<string, ActiveJob>();

function notifyJob(job: ActiveJob) {
  const payload = JSON.stringify({
    id: job.id,
    type: job.type,
    title: job.title,
    thumbnail: job.thumbnail,
    formatType: job.formatType,
    quality: job.quality,
    percent: job.percent,
    speed: job.speed,
    eta: job.eta,
    downloadedBytes: job.downloadedBytes,
    totalBytes: job.totalBytes,
    status: job.status,
    outputFile: job.outputFile,
    error: job.error,
  });

  const msg = `data: ${payload}\n\n`;
  for (const listener of job.listeners) {
    try {
      listener(msg);
    } catch {
      job.listeners.delete(listener);
    }
  }
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return "00:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  console.log(`[${new Date().toLocaleTimeString("tr-TR")}] ${req.method} ${url.pathname}`);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Sistem Durumu
  if (url.pathname === "/api/status" && req.method === "GET") {
    return new Response(
      JSON.stringify({
        ready: true,
        downloadsDir: DOWNLOADS_DIR,
        ytDlpAvailable: true,
        ffmpegAvailable: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Video Bilgisi Getirme (POST /api/info)
  if (url.pathname === "/api/info" && req.method === "POST") {
    try {
      const { videoUrl } = await req.json();
      if (!videoUrl || typeof videoUrl !== "string") {
        return new Response(JSON.stringify({ error: "Geçerli bir video URL adresi girin" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const args = [
        "--no-check-certificates",
        "--dump-single-json",
        "--no-playlist",
        "--skip-download",
        "--js-runtimes", `deno:${denoPath}`,
      ];
      if (ffmpegBinDir) {
        args.push("--ffmpeg-location", ffmpegBinDir);
      }
      if (cookieBrowser) {
        args.push("--cookies-from-browser", cookieBrowser);
      }
      args.push(videoUrl);

      const cmd = new Deno.Command(ytDlpPath, {
        args,
        env: { PATH: augmentedPath },
        stdout: "piped",
        stderr: "piped",
      });

      const output = await cmd.output();
      if (!output.success) {
        const errText = new TextDecoder().decode(output.stderr);
        return new Response(
          JSON.stringify({
            error: "Video bilgileri alınamadı. Bağlantının herkese açık olduğunu kontrol edin.",
            details: errText.slice(0, 300),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rawJson = new TextDecoder().decode(output.stdout);
      const data = JSON.parse(rawJson);

      const availableHeights = new Set<number>();
      if (Array.isArray(data.formats)) {
        for (const f of data.formats) {
          if (f.height && typeof f.height === "number") {
            availableHeights.add(f.height);
          }
        }
      }

      const sortedResolutions = Array.from(availableHeights).sort((a, b) => b - a);

      const responsePayload = {
        title: data.title || "İsimsiz Video",
        thumbnail: data.thumbnail || (data.thumbnails && data.thumbnails[0]?.url) || "",
        uploader: data.uploader || data.channel || "Bilinmeyen Kanal",
        duration: data.duration || 0,
        durationFormatted: formatDuration(data.duration),
        viewCount: data.view_count || 0,
        webpageUrl: data.webpage_url || videoUrl,
        resolutions: sortedResolutions,
      };

      return new Response(JSON.stringify(responsePayload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message || "Video bilgisi alınırken hata oluştu" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // 3. İndirme Başlatma (POST /api/download)
  if (url.pathname === "/api/download" && req.method === "POST") {
    try {
      const body = await req.json();
      const { videoUrl, formatType = "mp4", quality = "best", title = "", subtitles = false } = body;

      if (!videoUrl) {
        return new Response(JSON.stringify({ error: "URL gerekli" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Zaten devam eden aynı URL'e ait indirme varsa mükerrer işlem başlatma
      for (const [existingId, existingJob] of jobs) {
        if (
          existingJob.url === videoUrl &&
          (existingJob.status === "starting" || existingJob.status === "downloading" || existingJob.status === "merging")
        ) {
          return new Response(JSON.stringify({ jobId: existingId, message: "İndirme zaten sürüyor" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const jobId = "dl_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

      const job: ActiveJob = {
        id: jobId,
        type: "download",
        url: videoUrl,
        title: title || "Video İndiriliyor...",
        formatType,
        quality,
        percent: 0,
        speed: "0 MB/s",
        eta: "--:--",
        downloadedBytes: "0 MB",
        totalBytes: "Hesaplanıyor...",
        status: "starting",
        listeners: new Set(),
      };

      jobs.set(jobId, job);

      const args = [
        "--no-check-certificates",
        "--no-playlist",
        "--js-runtimes", `deno:${denoPath}`,
        "-N", "8",
        "--buffer-size", "64K",
        "--http-chunk-size", "10M",
        "--throttled-rate", "100K",
        "--newline",
        "--progress-template",
        "download:NOVAPROG:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_str)s|%(progress._downloaded_bytes_str)s",
      ];

      if (ffmpegBinDir) {
        args.push("--ffmpeg-location", ffmpegBinDir);
      }

      if (cookieBrowser) {
        args.push("--cookies-from-browser", cookieBrowser);
      }

      args.push("-o", `${DOWNLOADS_DIR}\\%(title).180B [%(id)s].%(ext)s`);

      if (formatType === "mp3") {
        args.push("-x", "--audio-format", "mp3", "--audio-quality", "0");
      } else if (formatType === "wav") {
        args.push("-x", "--audio-format", "wav");
      } else if (formatType === "m4a") {
        args.push("-x", "--audio-format", "m4a");
      } else if (formatType === "flac") {
        args.push("-x", "--audio-format", "flac");
      } else if (formatType === "opus") {
        args.push("-x", "--audio-format", "opus");
      } else {
        // Video Formatları (mp4, mkv, webm, mov)
        let mergeExt = "mp4";
        if (formatType === "mkv") mergeExt = "mkv";
        else if (formatType === "webm") mergeExt = "webm";
        else if (formatType === "mov") mergeExt = "mov";

        if (quality === "best") {
          if (formatType === "webm") {
            args.push("-f", "bv*[ext=webm]+ba[ext=webm]/bv*+ba/b");
          } else {
            args.push("-f", "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b[ext=mp4]/b");
          }
        } else {
          const height = parseInt(quality, 10);
          if (!isNaN(height) && height > 0) {
            if (formatType === "webm") {
              args.push(
                "-f",
                `bv*[height<=${height}][ext=webm]+ba[ext=webm]/bv*[height<=${height}]+ba/b[height<=${height}]/b`
              );
            } else {
              args.push(
                "-f",
                `bv*[height<=${height}][ext=mp4]+ba[ext=m4a]/bv*[height<=${height}]+ba/b[height<=${height}]/b`
              );
            }
          } else {
            args.push("-f", "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b[ext=mp4]/b");
          }
        }
        args.push("--merge-output-format", mergeExt);
      }

      if (subtitles) {
        args.push("--write-subs", "--write-auto-subs", "--sub-langs", "tr,en", "--embed-subs");
      }

      args.push(videoUrl);

      const cmd = new Deno.Command(ytDlpPath, {
        args,
        env: { PATH: augmentedPath },
        stdout: "piped",
        stderr: "piped",
      });

      const child = cmd.spawn();
      job.process = child;
      job.status = "downloading";
      notifyJob(job);

      (async () => {
        let stderrAccumulated = "";

        // stderr akışını eşzamanlı tüket (Windows pipe tamponunun 4KB'ta tıkanıp işlemi dondurmasını önler)
        const drainStderr = (async () => {
          try {
            const errReader = child.stderr.pipeThrough(new TextDecoderStream()).getReader();
            while (true) {
              const { done, value } = await errReader.read();
              if (done) break;
              stderrAccumulated += value;
            }
          } catch {
            // gözardı et
          }
        })();

        const reader = child.stdout.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("NOVAPROG:")) {
                const parts = trimmed.substring("NOVAPROG:".length).split("|");
                if (parts.length >= 5) {
                  const rawPercent = parts[0].trim().replace("%", "");
                  const pNum = parseFloat(rawPercent);
                  if (!isNaN(pNum)) {
                    job.percent = pNum;
                  }
                  job.speed = parts[1].trim() || job.speed;
                  job.eta = parts[2].trim() || job.eta;
                  job.totalBytes = parts[3].trim() || job.totalBytes;
                  job.downloadedBytes = parts[4].trim() || job.downloadedBytes;
                  job.status = "downloading";
                  notifyJob(job);
                }
              } else if (trimmed.includes("[Merger]") || trimmed.includes("Merging formats")) {
                job.status = "merging";
                job.percent = 99;
                job.speed = "Birleştiriliyor...";
                const mergerMatch = trimmed.match(/Merging formats into ["']?([^"']+)["']?/i);
                if (mergerMatch && mergerMatch[1]) {
                  job.outputFile = mergerMatch[1].trim();
                }
                notifyJob(job);
              } else if (trimmed.includes("[ExtractAudio]") || trimmed.includes("Destination: ")) {
                if (["mp3", "wav", "m4a", "flac", "opus"].includes(job.formatType)) {
                  job.status = "extracting";
                  job.speed = "Ses dönüştürülüyor...";
                  notifyJob(job);
                }
                const destMatch = trimmed.match(/Destination:\s*(.+)$/i);
                if (destMatch && destMatch[1]) {
                  job.outputFile = destMatch[1].trim();
                }
              } else if (trimmed.startsWith("[download] Destination: ")) {
                job.outputFile = trimmed.replace("[download] Destination: ", "").trim();
              } else if (trimmed.includes("has already been downloaded")) {
                const match = trimmed.match(/\[download\]\s*(?:Destination:\s*)?(.+?)\s+has already been downloaded/i);
                if (match && match[1]) {
                  job.outputFile = match[1].trim();
                }
              }
            }
          }
        } catch (e) {
          console.error("Stdout okuma hatası:", e);
        }

        const status = await child.status;
        await drainStderr;

        if (status.success) {
          job.percent = 100;
          job.status = "completed";
          job.speed = "✓ Tamamlandı";
          job.eta = "00:00";

          // Çıktı dosyasını doğrula veya en son eklenen dosyayı tespit et
          let finalPath = job.outputFile;
          let fileFound = false;

          if (finalPath) {
            try {
              if (Deno.statSync(finalPath).isFile) {
                fileFound = true;
              }
            } catch {
              fileFound = false;
            }
          }

          // Eğer outputFile doğrudan bulunamadıysa downloads klasöründeki en son dosyayı bul
          if (!fileFound) {
            try {
              let newestPath = "";
              let newestMtime = 0;
              for (const entry of Deno.readDirSync(DOWNLOADS_DIR)) {
                if (entry.isFile && !entry.name.endsWith(".part") && !entry.name.endsWith(".ytdl") && !/\.f\d+\.[a-z0-9]+$/i.test(entry.name) && entry.name !== ".gitkeep") {
                  const p = `${DOWNLOADS_DIR}\\${entry.name}`;
                  try {
                    const s = Deno.statSync(p);
                    if (s.mtime && s.mtime.getTime() > newestMtime) {
                      newestMtime = s.mtime.getTime();
                      newestPath = p;
                    }
                  } catch {
                    // devam et
                  }
                }
              }
              if (newestPath) {
                job.outputFile = newestPath;
                finalPath = newestPath;
                fileFound = true;
              }
            } catch {
              // devam et
            }
          }

          // Çıktı dosyasının gerçek boyutunu tespit et
          if (finalPath && fileFound) {
            try {
              const stat = Deno.statSync(finalPath);
              job.totalBytes = formatBytes(stat.size);
              job.downloadedBytes = job.totalBytes;
            } catch {
              // devam et
            }
          } else {
            job.totalBytes = "Tamamlandı";
          }

          notifyJob(job);
        } else if (job.status !== "cancelled") {
          job.status = "error";
          const rawErr = stderrAccumulated.trim();
          if (rawErr.includes("Sign in to confirm you're not a bot")) {
            job.error = "Site bot doğrulaması istedi. Lütfen birkaç dakika bekleyin veya farklı bir video deneyin.";
          } else {
            const errorLines = rawErr.split("\n").filter(l => l.includes("ERROR:") || (!l.includes("WARNING:") && l.trim()));
            job.error = errorLines.pop() || rawErr || "İndirme sırasında bir hata oluştu";
          }
          notifyJob(job);
        }
      })();

      return new Response(JSON.stringify({ jobId, message: "İndirme başlatıldı" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message || "İndirme başlatılamadı" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // 4. İlerleme Takibi (SSE - Server-Sent Events)
  if (url.pathname.startsWith("/api/progress/")) {
    const jobId = url.pathname.replace("/api/progress/", "");
    const job = jobs.get(jobId);

    if (!job) {
      return new Response("İş bulunamadı", { status: 404 });
    }

    let timer: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream({
      start(controller) {
        const send = (msg: string) => {
          try {
            controller.enqueue(new TextEncoder().encode(msg));
          } catch {
            job.listeners.delete(send);
          }
        };

        job.listeners.add(send);
        notifyJob(job);

        timer = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(": ping\n\n"));
          } catch {
            clearInterval(timer);
          }
        }, 15000);
      },
      cancel() {
        if (timer) clearInterval(timer);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        ...corsHeaders,
      },
    });
  }

  // 5. İndirmeyi İptal Et (POST /api/cancel/:id)
  if (url.pathname.startsWith("/api/cancel/") && req.method === "POST") {
    const jobId = url.pathname.replace("/api/cancel/", "");
    const job = jobs.get(jobId);
    if (job) {
      try {
        if (job.process) {
          const pid = job.process.pid;
          try {
            job.process.kill();
          } catch {}
          try {
            // Windows'ta alt işlem ağacını (tree) zorla sonlandırarak .part kilitlerini anında çöz
            const killCmd = new Deno.Command("taskkill", {
              args: ["/F", "/T", "/PID", pid.toString()],
              stdout: "null",
              stderr: "null",
            });
            await killCmd.output();
          } catch {}
        }
        job.status = "cancelled";
        job.speed = "İptal edildi";
        notifyJob(job);
      } catch {
        // gözardı et
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "İş bulunamadı" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 6. İndirilen Dosyalar Geçmişi (GET /api/history)
  if (url.pathname === "/api/history" && req.method === "GET") {
    try {
      const files: any[] = [];
      for (const entry of Deno.readDirSync(DOWNLOADS_DIR)) {
        if (entry.isFile && !entry.name.endsWith(".part") && !entry.name.endsWith(".ytdl") && !/\.f\d+\.[a-z0-9]+$/i.test(entry.name) && entry.name !== ".gitkeep") {
          const fullPath = `${DOWNLOADS_DIR}\\${entry.name}`;
          try {
            const stat = Deno.statSync(fullPath);
            const ext = entry.name.split(".").pop()?.toLowerCase() || "";
            const isVideo = ["mp4", "mkv", "webm", "avi", "mov", "flv"].includes(ext);
            const isAudio = ["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(ext);

            files.push({
              name: entry.name,
              path: fullPath,
              sizeBytes: stat.size,
              sizeFormatted: formatBytes(stat.size),
              mtime: stat.mtime?.getTime() || 0,
              dateFormatted: stat.mtime ? new Date(stat.mtime).toLocaleString("tr-TR") : "",
              ext,
              isVideo,
              isAudio,
            });
          } catch {
            // dosya okunamadı
          }
        }
      }

      files.sort((a, b) => b.mtime - a.mtime);

      return new Response(JSON.stringify(files), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 7. İndirilenler Klasörünü Aç (POST /api/open-folder)
  if (url.pathname === "/api/open-folder" && req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      const filePath = body.filePath;

      let psScript = "";
      if (filePath) {
        psScript = `
          $p = '${filePath.replace(/'/g, "''")}';
          if (Test-Path -LiteralPath $p) {
            Start-Process -FilePath "explorer.exe" -ArgumentList "/select,\`"$p\`""
          } else {
            Start-Process -FilePath "explorer.exe" -ArgumentList "\`"${DOWNLOADS_DIR.replace(/'/g, "''")}\`""
          }
        `;
      } else {
        psScript = `Start-Process -FilePath "explorer.exe" -ArgumentList "\`"${DOWNLOADS_DIR.replace(/'/g, "''")}\`""`;
      }

      new Deno.Command("powershell.exe", {
        args: ["-NoProfile", "-NonInteractive", "-Command", psScript],
        stdout: "null",
        stderr: "null",
      }).spawn();

      return new Response(JSON.stringify({ success: true, target: filePath || DOWNLOADS_DIR }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 8. Dosyayı Varsayılan Oynatıcıda Aç (POST /api/play-file)
  if (url.pathname === "/api/play-file" && req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      const filePath = body.filePath;
      if (filePath) {
        const psScript = `
          $p = '${filePath.replace(/'/g, "''")}';
          if (Test-Path -LiteralPath $p) {
            Start-Process -FilePath $p
          }
        `;
        new Deno.Command("powershell.exe", {
          args: ["-NoProfile", "-NonInteractive", "-Command", psScript],
          stdout: "null",
          stderr: "null",
        }).spawn();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Dosya yolu gerekli veya dosya henüz hazır değil." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 8.1. Medya Dosyası Oynatma / Akışı (GET /api/media?path=...)
  if (url.pathname === "/api/media" && req.method === "GET") {
    const rawPath = url.searchParams.get("path") || "";
    let safePath = rawPath;
    if (!safePath.includes(":\\") && !safePath.startsWith("\\\\")) {
      safePath = `${DOWNLOADS_DIR}\\${safePath.replace(/^[/\\]+/, "")}`;
    }

    try {
      const fileInfo = await Deno.stat(safePath);
      if (!fileInfo.isFile) {
        return new Response("Dosya bulunamadı", { status: 404 });
      }

      const ext = safePath.substring(safePath.lastIndexOf(".")).toLowerCase();
      const contentType = MIME_TYPES[ext] || "video/mp4";
      const fileSize = fileInfo.size;
      const file = await Deno.open(safePath, { read: true });

      return new Response(file.readable, {
        headers: {
          "Content-Length": fileSize.toString(),
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          ...corsHeaders,
        },
      });
    } catch {
      return new Response("Dosya açılamadı", { status: 404 });
    }
  }

  // 9. Yerel Dosya Dönüştürme (POST /api/convert)
  if (url.pathname === "/api/convert" && req.method === "POST") {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const targetFormat = (formData.get("targetFormat") as string) || "mp4";
      const preset = (formData.get("preset") as string) || "high";

      if (!file) {
        return new Response(JSON.stringify({ error: "Lütfen bir dosya seçin" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tempInPath = `${DOWNLOADS_DIR}\\temp_in_${Date.now()}_${file.name}`;
      const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
      const outFileName = `${baseName}_donusturuldu.${targetFormat}`;
      const tempOutPath = `${DOWNLOADS_DIR}\\${outFileName}`;

      const fileBuffer = await file.arrayBuffer();
      await Deno.writeFile(tempInPath, new Uint8Array(fileBuffer));

      const args = ["-y", "-i", tempInPath];

      if (targetFormat === "mp3") {
        args.push("-vn", "-c:a", "libmp3lame", "-b:a", "320k");
      } else if (targetFormat === "wav") {
        args.push("-vn", "-c:a", "pcm_s16le");
      } else if (targetFormat === "m4a") {
        args.push("-vn", "-c:a", "aac", "-b:a", "256k");
      } else if (targetFormat === "flac") {
        args.push("-vn", "-c:a", "flac");
      } else if (targetFormat === "opus") {
        args.push("-vn", "-c:a", "libopus", "-b:a", "192k");
      } else if (targetFormat === "gif") {
        args.push("-vf", "fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse");
      } else if (targetFormat === "mkv" || targetFormat === "mov") {
        args.push("-c:v", "libx264", "-c:a", "aac", "-b:a", "192k", "-crf", "20", "-preset", "medium");
      } else if (targetFormat === "webm") {
        args.push("-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-c:a", "libopus", "-b:a", "128k");
      } else if (targetFormat === "mp4") {
        args.push("-c:v", "libx264", "-c:a", "aac", "-b:a", "192k");
        if (preset === "compress") {
          args.push("-crf", "28", "-preset", "faster");
        } else if (preset === "720p") {
          args.push("-vf", "scale=-2:720", "-crf", "23");
        } else if (preset === "1080p") {
          args.push("-vf", "scale=-2:1080", "-crf", "20");
        } else {
          args.push("-crf", "20", "-preset", "medium");
        }
      }

      args.push(tempOutPath);

      const convCmd = new Deno.Command(ffmpegPath, {
        args,
        stdout: "piped",
        stderr: "piped",
      });

      const convChild = await convCmd.output();

      try {
        await Deno.remove(tempInPath);
      } catch {
        // devam et
      }

      if (!convChild.success) {
        const errText = new TextDecoder().decode(convChild.stderr);
        return new Response(
          JSON.stringify({ error: "Dönüştürme başarısız oldu", details: errText.slice(0, 300) }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          outputFile: outFileName,
          outputPath: tempOutPath,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message || "Dönüştürme sırasında hata oluştu" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // 10. Statik Dosyalar
  return serveStaticFile(url.pathname);
}

// Sunucuyu Dinlemeye Başla
Deno.serve({ port: PORT, onListen: () => console.log(`Sunucu aktif: http://localhost:${PORT}`) }, handleRequest);
