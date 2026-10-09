// HD Video İndirici & Dönüştürücü - İstemci Mantığı

document.addEventListener("DOMContentLoaded", () => {
  // DOM Öğeleri
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // İndirici Öğeleri
  const videoUrlInput = document.getElementById("videoUrlInput");
  const btnPaste = document.getElementById("btnPaste");
  const btnFetchInfo = document.getElementById("btnFetchInfo");
  const fetchSpinner = document.getElementById("fetchSpinner");
  const previewCard = document.getElementById("previewCard");
  const prevThumb = document.getElementById("prevThumb");
  const prevDuration = document.getElementById("prevDuration");
  const prevTitle = document.getElementById("prevTitle");
  const prevUploader = document.getElementById("prevUploader");
  const prevViews = document.getElementById("prevViews");
  const qualitySelect = document.getElementById("qualitySelect");
  const resolutionGroup = document.getElementById("resolutionGroup");
  const subsGroup = document.getElementById("subsGroup");
  const chkSubtitles = document.getElementById("chkSubtitles");
  const btnStartDownload = document.getElementById("btnStartDownload");
  const downloadsList = document.getElementById("downloadsList");
  const emptyDownloadsState = document.getElementById("emptyDownloadsState");
  const activeJobsCount = document.getElementById("activeJobsCount");

  // Toplu İndirme Öğeleri
  const batchHeader = document.getElementById("batchHeader");
  const batchContent = document.getElementById("batchContent");
  const batchUrls = document.getElementById("batchUrls");
  const btnStartBatch = document.getElementById("btnStartBatch");

  // Yerel Dönüştürücü Öğeleri
  const dropZone = document.getElementById("dropZone");
  const localFileInput = document.getElementById("localFileInput");
  const btnSelectLocalFile = document.getElementById("btnSelectLocalFile");
  const selectedFileInfo = document.getElementById("selectedFileInfo");
  const selectedFileName = document.getElementById("selectedFileName");
  const selectedFileSize = document.getElementById("selectedFileSize");
  const convTargetFormat = document.getElementById("convTargetFormat");
  const convPreset = document.getElementById("convPreset");
  const btnStartConvert = document.getElementById("btnStartConvert");
  const convProgressBox = document.getElementById("convProgressBox");
  const convStatusText = document.getElementById("convStatusText");

  // Geçmiş Öğeleri
  const historyTableBody = document.getElementById("historyTableBody");
  const emptyHistoryState = document.getElementById("emptyHistoryState");
  const btnRefreshHistory = document.getElementById("btnRefreshHistory");
  const btnOpenDownloadsTop = document.getElementById("btnOpenDownloadsTop");
  const btnOpenDownloadsHistory = document.getElementById("btnOpenDownloadsHistory");

  let currentVideoInfo = null;
  let activeDownloads = new Map();
  let selectedFileForConversion = null;

  // 1. Sekme Geçişleri
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTabId = btn.getAttribute("data-tab");
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add("active");
      }

      if (targetTabId === "tab-history") {
        loadHistory();
      }
    });
  });

  // Yeni Hızlı İndirme Öğeleri
  const btnQuickDownload = document.getElementById("btnQuickDownload");
  const mainQualitySelect = document.getElementById("mainQualitySelect");
  const mainQualityWrapper = document.getElementById("mainQualityWrapper");
  const urlStatusBadge = document.getElementById("urlStatusBadge");
  const urlStatusMessage = document.getElementById("urlStatusMessage");

  // Format Değişikliği (Ana Kart)
  document.querySelectorAll('input[name="mainFormatChoice"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "mp3" || val === "wav" || val === "m4a") {
        if (mainQualityWrapper) mainQualityWrapper.classList.add("hidden");
      } else {
        if (mainQualityWrapper) mainQualityWrapper.classList.remove("hidden");
      }

      // Önizleme kartındaki seçimi de eşitle
      const prevRadio = document.querySelector(`input[name="formatChoice"][value="${val}"]`);
      if (prevRadio) {
        prevRadio.checked = true;
        prevRadio.dispatchEvent(new Event("change"));
      }
    });
  });

  // 2. Panodan Yapıştırma
  btnPaste.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        videoUrlInput.value = text.trim();
        handleUrlChange();
      }
    } catch {
      videoUrlInput.focus();
    }
  });

  // URL girişini anında algıla (Paste, Input, Change)
  let urlDebounceTimer;
  function handleUrlChange() {
    const url = videoUrlInput.value.trim();
    if (!url) {
      if (urlStatusBadge) urlStatusBadge.classList.add("hidden");
      return;
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (urlStatusBadge && urlStatusMessage) {
        urlStatusBadge.classList.remove("hidden");
        urlStatusMessage.textContent = "⚡ Bağlantı algılandı! Hemen İndir butonuna basabilir veya bilgilerin yüklenmesini bekleyebilirsiniz...";
      }

      clearTimeout(urlDebounceTimer);
      urlDebounceTimer = setTimeout(() => {
        triggerFetchInfo(true);
      }, 400);
    }
  }

  videoUrlInput.addEventListener("input", handleUrlChange);
  videoUrlInput.addEventListener("paste", () => {
    setTimeout(handleUrlChange, 60);
  });
  videoUrlInput.addEventListener("change", handleUrlChange);

  // Enter tuşuna basıldığında
  videoUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      triggerFetchInfo(false);
    }
  });

  // "Hemen İndir" Ana Butonu (URL yapıştırıldığı an beklemeden indirme başlatır)
  if (btnQuickDownload) {
    btnQuickDownload.addEventListener("click", () => {
      const url = videoUrlInput.value.trim();
      if (!url) {
        alert("Lütfen önce bir video bağlantısı yapıştırın.");
        videoUrlInput.focus();
        return;
      }

      const formatInput = document.querySelector('input[name="mainFormatChoice"]:checked');
      const selectedFormat = formatInput ? formatInput.value : "mp4";
      const quality = mainQualitySelect ? mainQualitySelect.value : "1080";

      const title = currentVideoInfo ? currentVideoInfo.title : "Video İndiriliyor...";
      startDownloadJob(url, title, selectedFormat, quality, false);

      const activeSection = document.getElementById("activeDownloadsSection");
      if (activeSection) {
        activeSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  btnFetchInfo.addEventListener("click", () => {
    triggerFetchInfo(false);
  });

  // 3. Format Değişikliği (MP4 vs MP3 vs WAV - Önizleme Kartı)
  document.querySelectorAll('input[name="formatChoice"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "mp3" || val === "wav" || val === "m4a") {
        resolutionGroup.classList.add("hidden");
        subsGroup.classList.add("hidden");
      } else {
        resolutionGroup.classList.remove("hidden");
        subsGroup.classList.remove("hidden");
      }

      const mainRadio = document.querySelector(`input[name="mainFormatChoice"][value="${val}"]`);
      if (mainRadio && !mainRadio.checked) {
        mainRadio.checked = true;
      }
    });
  });

  // 4. Video Bilgisi Getirme Fonksiyonu
  async function triggerFetchInfo(isAuto = false) {
    const url = videoUrlInput.value.trim();
    if (!url) {
      if (!isAuto) {
        alert("Lütfen geçerli bir video URL bağlantısı girin.");
        videoUrlInput.focus();
      }
      return;
    }

    btnFetchInfo.disabled = true;
    fetchSpinner.classList.remove("hidden");
    const btnText = btnFetchInfo.querySelector(".btn-text");
    if (btnText) btnText.textContent = "İnceleniyor...";

    if (urlStatusBadge && urlStatusMessage) {
      urlStatusBadge.classList.remove("hidden");
      urlStatusMessage.textContent = "🔍 Video bilgileri YouTube / siteden çekiliyor...";
    }

    try {
      const res = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: url }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Video bilgileri alınamadı");
      }

      currentVideoInfo = data;
      renderPreview(data);

      if (urlStatusBadge && urlStatusMessage) {
        urlStatusMessage.textContent = `✓ Bulundu: ${data.title} (${data.durationFormatted})`;
      }
    } catch (err) {
      if (!isAuto) {
        alert("Hata: " + (err.message || "Video bulunamadı."));
      }
      if (urlStatusBadge && urlStatusMessage) {
        urlStatusMessage.textContent = "ℹ️ Doğrudan 'Hemen İndir' butonuna basarak indirmeyi başlatabilirsiniz.";
      }
    } finally {
      btnFetchInfo.disabled = false;
      fetchSpinner.classList.add("hidden");
      if (btnText) btnText.textContent = "🔍 İncele";
    }
  }

  // 5. Önizleme Kartını Doldur
  function renderPreview(info) {
    prevTitle.textContent = info.title || "Video";
    prevThumb.src = info.thumbnail || "";
    prevDuration.textContent = info.durationFormatted || "00:00";
    prevUploader.textContent = info.uploader || "Kanal";
    prevViews.textContent = info.viewCount ? Number(info.viewCount).toLocaleString("tr-TR") + " görüntüleme" : "";

    // Çözünürlükleri doldur
    qualitySelect.innerHTML = `<option value="best">🌟 En Yüksek Kalite (Otomatik HD/4K)</option>`;

    const resolutions = info.resolutions || [];
    const standardQualities = [
      { h: 2160, label: "4K Ultra HD (2160p)" },
      { h: 1440, label: "2K Quad HD (1440p)" },
      { h: 1080, label: "1080p Full HD (Önerilen)" },
      { h: 720, label: "720p HD" },
      { h: 480, label: "480p Standart" },
      { h: 360, label: "360p Düşük Boyut" },
    ];

    if (resolutions.length > 0) {
      for (const sq of standardQualities) {
        if (resolutions.includes(sq.h) || resolutions.some((r) => r >= sq.h)) {
          const opt = document.createElement("option");
          opt.value = sq.h.toString();
          opt.textContent = sq.label;
          if (sq.h === 1080) opt.selected = true;
          qualitySelect.appendChild(opt);
        }
      }
    } else {
      // Varsayılan seçenekleri ekle
      for (const sq of standardQualities) {
        const opt = document.createElement("option");
        opt.value = sq.h.toString();
        opt.textContent = sq.label;
        if (sq.h === 1080) opt.selected = true;
        qualitySelect.appendChild(opt);
      }
    }

    previewCard.classList.remove("hidden");
    previewCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // 6. İndirmeyi Başlat
  btnStartDownload.addEventListener("click", () => {
    if (!currentVideoInfo) {
      triggerFetchInfo();
      return;
    }

    const formatInput = document.querySelector('input[name="formatChoice"]:checked');
    const selectedFormat = formatInput ? formatInput.value : "mp4";
    const quality = qualitySelect.value;
    const subtitles = chkSubtitles.checked;

    startDownloadJob(currentVideoInfo.webpageUrl, currentVideoInfo.title, selectedFormat, quality, subtitles);
  });

  async function startDownloadJob(videoUrl, title, formatType, quality, subtitles) {
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          title,
          formatType,
          quality,
          subtitles,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "İndirme başlatılamadı");
      }

      createDownloadCard(data.jobId, title, formatType);
    } catch (err) {
      alert("İndirme hatası: " + err.message);
    }
  }

  // 7. İndirme Kartı ve SSE İlerleme Akışı
  function createDownloadCard(jobId, title, formatType) {
    emptyDownloadsState.classList.add("hidden");

    const card = document.createElement("div");
    card.className = "download-item-card";
    card.id = `job_card_${jobId}`;

    card.innerHTML = `
      <div class="dl-header">
        <div class="dl-title-box">
          <span class="dl-format-tag ${formatType}">${formatType.toUpperCase()}</span>
          <span class="dl-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
        </div>
        <span class="dl-percent" id="percent_${jobId}">%0</span>
      </div>

      <div class="progress-bar-wrapper">
        <div class="progress-bar-fill" id="bar_${jobId}"></div>
      </div>

      <div class="dl-stats-row">
        <div class="dl-stats-left">
          <span class="dl-status-text" id="status_${jobId}">Bağlantı kuruluyor...</span>
          <span id="speed_${jobId}">⚡ 0 MB/s</span>
          <span id="eta_${jobId}">⏳ Kalan: --:--</span>
          <span id="size_${jobId}">💾 0 MB</span>
        </div>
        <div class="dl-actions" id="actions_${jobId}">
          <button class="btn btn-secondary btn-sm" id="btnCancel_${jobId}">İptal</button>
        </div>
      </div>
    `;

    downloadsList.prepend(card);
    updateActiveCount();

    // İptal Butonu
    const btnCancel = card.querySelector(`#btnCancel_${jobId}`);
    if (btnCancel) {
      btnCancel.addEventListener("click", () => {
        fetch(`/api/cancel/${jobId}`, { method: "POST" });
        btnCancel.disabled = true;
        btnCancel.textContent = "İptal ediliyor...";
      });
    }

    // SSE Dinleyicisi
    const eventSource = new EventSource(`/api/progress/${jobId}`);
    activeDownloads.set(jobId, eventSource);

    eventSource.onmessage = (event) => {
      try {
        const job = JSON.parse(event.data);
        const percentEl = document.getElementById(`percent_${jobId}`);
        const barEl = document.getElementById(`bar_${jobId}`);
        const statusEl = document.getElementById(`status_${jobId}`);
        const speedEl = document.getElementById(`speed_${jobId}`);
        const etaEl = document.getElementById(`eta_${jobId}`);
        const sizeEl = document.getElementById(`size_${jobId}`);
        const actionsEl = document.getElementById(`actions_${jobId}`);

        if (percentEl) percentEl.textContent = `%${Math.round(job.percent)}`;
        if (barEl) barEl.style.width = `${job.percent}%`;

        if (speedEl) speedEl.textContent = `⚡ ${job.speed}`;
        if (etaEl) etaEl.textContent = `⏳ ${job.eta}`;
        if (sizeEl) sizeEl.textContent = `💾 ${job.downloadedBytes} / ${job.totalBytes}`;

        if (statusEl) {
          if (job.status === "downloading") {
            statusEl.textContent = "İndiriliyor...";
            statusEl.style.color = "#38bdf8";
          } else if (job.status === "merging") {
            statusEl.textContent = "FFmpeg ile ses ve video birleştiriliyor...";
            statusEl.style.color = "#f59e0b";
          } else if (job.status === "extracting") {
            statusEl.textContent = "Ses ayıklanıyor ve dönüştürülüyor...";
            statusEl.style.color = "#f59e0b";
          } else if (job.status === "completed") {
            statusEl.textContent = "✓ Tamamlandı!";
            statusEl.style.color = "#10b981";
            if (barEl) barEl.style.width = "100%";
            if (percentEl) percentEl.textContent = "%100";
            if (speedEl) speedEl.textContent = "✓ Hazır";
            if (etaEl) etaEl.textContent = "";
            if (sizeEl) sizeEl.textContent = `💾 ${job.totalBytes || "Tamamlandı"}`;

            if (actionsEl) {
              actionsEl.innerHTML = `
                <button class="btn btn-secondary btn-sm" onclick="openFileInFolder('${escapeHtml(job.outputFile || "")}')">Klasörde Göster</button>
                <button class="btn btn-primary btn-sm" onclick="playFile('${escapeHtml(job.outputFile || "")}')">▶ Oynat</button>
              `;
            }

            eventSource.close();
            activeDownloads.delete(jobId);
            updateActiveCount();
            loadHistory();
          } else if (job.status === "cancelled") {
            statusEl.textContent = "İptal Edildi";
            statusEl.style.color = "#ef4444";
            eventSource.close();
            activeDownloads.delete(jobId);
            updateActiveCount();
          } else if (job.status === "error") {
            statusEl.textContent = "Hata: " + (job.error ? job.error.slice(0, 100) : "İndirme başarısız");
            statusEl.style.color = "#ef4444";
            eventSource.close();
            activeDownloads.delete(jobId);
            updateActiveCount();
          }
        }
      } catch (err) {
        console.error("SSE Ayrıştırma Hatası:", err);
      }
    };

    eventSource.onerror = () => {
      // Bağlantı koptuysa veya kapandıysa
    };
  }

  function updateActiveCount() {
    activeJobsCount.textContent = `${activeDownloads.size} Görev`;
  }

  // 8. Toplu İndirme Katmanı
  batchHeader.addEventListener("click", () => {
    const isHidden = batchContent.classList.contains("hidden");
    const arrow = batchHeader.querySelector(".accordion-arrow");
    if (isHidden) {
      batchContent.classList.remove("hidden");
      if (arrow) arrow.textContent = "▲";
    } else {
      batchContent.classList.add("hidden");
      if (arrow) arrow.textContent = "▼";
    }
  });

  btnStartBatch.addEventListener("click", async () => {
    const lines = batchUrls.value
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("http"));

    if (lines.length === 0) {
      alert("Lütfen her satıra bir adet geçerli URL girin.");
      return;
    }

    btnStartBatch.disabled = true;
    btnStartBatch.textContent = `İndirmeler başlatılıyor (${lines.length})...`;

    for (const url of lines) {
      await startDownloadJob(url, "Toplu İndirme", "mp4", "1080", false);
      await new Promise((r) => setTimeout(r, 600));
    }

    batchUrls.value = "";
    btnStartBatch.disabled = false;
    btnStartBatch.textContent = "Tümünü Sırayla İndir";
    batchContent.classList.add("hidden");
  });

  // 9. Yerel Dosya Dönüştürücü
  btnSelectLocalFile.addEventListener("click", () => {
    localFileInput.click();
  });

  dropZone.addEventListener("click", (e) => {
    if (e.target !== btnSelectLocalFile) {
      localFileInput.click();
    }
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      handleSelectedLocalFile(e.dataTransfer.files[0]);
    }
  });

  localFileInput.addEventListener("change", () => {
    if (localFileInput.files && localFileInput.files.length > 0) {
      handleSelectedLocalFile(localFileInput.files[0]);
    }
  });

  function handleSelectedLocalFile(file) {
    selectedFileForConversion = file;
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = formatBytes(file.size);
    selectedFileInfo.classList.remove("hidden");
    convProgressBox.classList.add("hidden");
  }

  btnStartConvert.addEventListener("click", async () => {
    if (!selectedFileForConversion) {
      alert("Lütfen önce dönüştürülecek bir dosya seçin.");
      return;
    }

    const targetFormat = convTargetFormat.value;
    const preset = convPreset.value;

    btnStartConvert.disabled = true;
    convProgressBox.classList.remove("hidden");
    convStatusText.textContent = "Dosya işleniyor ve FFmpeg ile dönüştürülüyor...";

    const formData = new FormData();
    formData.append("file", selectedFileForConversion);
    formData.append("targetFormat", targetFormat);
    formData.append("preset", preset);

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Dönüştürme başarısız oldu");
      }

      convStatusText.innerHTML = `✓ Dönüştürme Başarıyla Tamamlandı: <strong>${escapeHtml(data.outputFile)}</strong>`;
      convStatusText.style.color = "#10b981";
      loadHistory();
    } catch (err) {
      convStatusText.textContent = "Hata: " + err.message;
      convStatusText.style.color = "#ef4444";
    } finally {
      btnStartConvert.disabled = false;
    }
  });

  // 10. İndirilenler & Geçmiş Listesi
  async function loadHistory() {
    try {
      const res = await fetch("/api/history");
      const files = await res.json();

      historyTableBody.innerHTML = "";
      if (!files || files.length === 0) {
        emptyHistoryState.classList.remove("hidden");
        return;
      }

      emptyHistoryState.classList.add("hidden");
      for (const f of files) {
        const tr = document.createElement("tr");
        const extBadgeClass = f.isVideo ? "mp4" : f.isAudio ? "mp3" : "wav";

        tr.innerHTML = `
          <td><span class="dl-format-tag ${extBadgeClass}">${f.ext.toUpperCase()}</span></td>
          <td style="font-weight: 500; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(f.name)}">
            ${escapeHtml(f.name)}
          </td>
          <td style="color: #94a3b8;">${f.sizeFormatted}</td>
          <td style="color: #94a3b8;">${f.dateFormatted}</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="openFileInFolder('${escapeHtml(f.path)}')">Klasörde Göster</button>
            <button class="btn btn-primary btn-sm" onclick="playFile('${escapeHtml(f.path)}')">Oynat</button>
          </td>
        `;
        historyTableBody.appendChild(tr);
      }
    } catch (e) {
      console.error("Geçmiş yüklenemedi:", e);
    }
  }

  btnRefreshHistory.addEventListener("click", loadHistory);

  // 11. Klasör Açma İşlemleri
  btnOpenDownloadsTop.addEventListener("click", () => {
    fetch("/api/open-folder", { method: "POST" });
  });

  btnOpenDownloadsHistory.addEventListener("click", () => {
    fetch("/api/open-folder", { method: "POST" });
  });

  // İlk yüklemede geçmişi çek
  loadHistory();
});

// Global Yardımcı Fonksiyonlar (Pencere seviyesinde erişilebilir)
function openFileInFolder(filePath) {
  fetch("/api/open-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath }),
  });
}

function playFile(filePath) {
  fetch("/api/play-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath }),
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
