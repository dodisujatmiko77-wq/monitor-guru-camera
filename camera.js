(() => {
  "use strict";

  const state = {
    stream: null,
    facingMode: "environment",
    photoData: "",
    payload: null,
    sending: false,
    parentOrigin: "",
    parentWindow: null
  };

  const $ = id => document.getElementById(id);

  function setStatus(message, type = "") {
    const el = $("status");
    el.textContent = message || "";
    el.dataset.type = type;
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(t => t.stop());
      state.stream = null;
    }
    $("video").srcObject = null;
  }

  async function openCamera() {
    stopCamera();
    setStatus("Membuka kamera…");
    $("cameraMessage").textContent = "Membuka kamera…";
    $("cameraMessage").hidden = false;

    let stream = null;
    let firstError = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: state.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
    } catch (e) {
      firstError = e;
      console.warn("Kamera dengan facingMode gagal:", e);
    }

    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      } catch (e) {
        console.error("Fallback kamera gagal:", e);
        throw e || firstError;
      }
    }

    state.stream = stream;
    $("video").srcObject = stream;
    await $("video").play();

    $("cameraMessage").hidden = true;
    $("captureBtn").disabled = false;
    setStatus("Kamera siap.");
  }

  function capture() {
    const video = $("video");
    if (!video.videoWidth || !video.videoHeight) {
      setStatus("Kamera belum siap.");
      return;
    }

    const canvas = $("canvas");
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    state.photoData = canvas.toDataURL("image/jpeg", 0.84);
    $("preview").src = state.photoData;
    $("preview").hidden = false;
    $("video").hidden = true;
    $("guide").hidden = true;
    $("actions").hidden = true;
    $("previewActions").hidden = false;

    stopCamera();
    setStatus("Periksa foto. Jika sudah benar, konfirmasi.");
  }

  function retake() {
    $("preview").hidden = true;
    $("video").hidden = false;
    $("guide").hidden = false;
    $("actions").hidden = false;
    $("previewActions").hidden = true;
    state.photoData = "";
    openCamera().catch(handleCameraError);
  }

  function handleCameraError(err) {
    stopCamera();
    $("captureBtn").disabled = true;
    $("cameraMessage").hidden = false;
    $("cameraMessage").textContent = "Kamera tidak dapat dibuka";
    const name = err?.name || "UnknownError";

    if (name === "NotAllowedError") {
      setStatus("Akses kamera ditolak oleh browser/halaman ini.", "error");
    } else if (name === "NotReadableError") {
      setStatus("Kamera sedang digunakan aplikasi lain.", "error");
    } else if (name === "NotFoundError") {
      setStatus("Kamera tidak ditemukan.", "error");
    } else {
      setStatus("Kamera gagal dibuka: " + name, "error");
    }
  }

  async function confirmPhoto() {
    if (!state.photoData || state.sending) return;
    state.sending = true;
    $("confirmBtn").disabled = true;
    $("retakeBtn").disabled = true;
    setStatus("Mengirim foto…");

    const message = {
      type: "MONITOR_GURU_CAMERA_RESULT",
      success: true,
      photoData: state.photoData,
      context: state.payload || null,
      capturedAt: new Date().toISOString()
    };

    // Integrasi aplikasi utama: dukung iframe (Median/WebView) dan popup lama.
    const targetWindow = state.parentWindow || window.opener;
    if (targetWindow && state.parentOrigin) {
      targetWindow.postMessage(message, state.parentOrigin);
      setStatus("Foto berhasil dikirim ke aplikasi utama.");
      if (state.parentWindow) {
        setTimeout(() => stopCamera(), 300);
      } else {
        setTimeout(() => window.close(), 900);
      }
    } else {
      // Mode mandiri untuk pengujian kamera.
      setStatus("Foto berhasil diambil. Mode tes mandiri aktif.");
      state.sending = false;
      $("confirmBtn").disabled = false;
      $("retakeBtn").disabled = false;
    }
  }

  function readUrlContext() {
    /*
     * Fallback untuk Median/Android/WebView:
     * konteks jadwal dapat ditempel pada URL kamera.
     * Ini dipakai bila window.opener/postMessage tidak tersedia.
     */
    try {
      const params = new URLSearchParams(window.location.search);
      if (!params.has("namaGuru") && !params.has("scheduleId")) {
        return null;
      }

      const context = {
        mode: params.get("mode") || "IN",
        scheduleId: params.get("scheduleId") || "",
        namaGuru: params.get("namaGuru") || "",
        kelas: params.get("kelas") || "",
        mataPelajaran: params.get("mataPelajaran") || "",
        jamMulai: params.get("jamMulai") || "",
        jamSelesai: params.get("jamSelesai") || "",
        ruang: params.get("ruang") || ""
      };

      state.payload = context;

      $("teacherName").textContent = context.namaGuru || "—";
      $("className").textContent = context.kelas || "—";
      $("subjectName").textContent = context.mataPelajaran || "—";
      $("scheduleTime").textContent =
        context.jamMulai && context.jamSelesai
          ? `${context.jamMulai} - ${context.jamSelesai}`
          : "—";

      return context;
    } catch (e) {
      console.warn("Gagal membaca konteks URL kamera:", e);
      return null;
    }
  }

  function readContext() {
    // Konteks dapat dikirim dari aplikasi utama melalui postMessage.
    window.addEventListener("message", event => {
      const data = event.data;
      if (!data || data.type !== "MONITOR_GURU_CAMERA_INIT") return;

      // Mendukung iframe (event.source = parent) maupun popup lama.
      if (event.source !== window.parent && event.source !== window.opener) return;

      state.parentWindow = event.source;
      state.parentOrigin = event.origin;

      state.payload = data.context || null;

      const c = state.payload || {};
      $("teacherName").textContent = c.namaGuru || "—";
      $("className").textContent = c.kelas || "—";
      $("subjectName").textContent = c.mataPelajaran || "—";
      $("scheduleTime").textContent =
        c.jamMulai && c.jamSelesai ? `${c.jamMulai} - ${c.jamSelesai}` : "—";
    });

    // Mode mandiri: tidak perlu context.
  }

  function switchCamera() {
    state.facingMode =
      state.facingMode === "environment" ? "user" : "environment";
    openCamera().catch(handleCameraError);
  }

  $("captureBtn").addEventListener("click", capture);
  $("retakeBtn").addEventListener("click", retake);
  $("confirmBtn").addEventListener("click", confirmPhoto);
  $("switchBtn").addEventListener("click", switchCamera);
  $("closeBtn").addEventListener("click", () => {
    stopCamera();
    if (window.parent !== window) {
      window.parent.postMessage({ type: "MONITOR_GURU_CAMERA_CANCEL" }, state.parentOrigin || "*");
    } else if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      history.back();
    }
  });

  // Ambil konteks dari URL terlebih dahulu sebagai fallback Median.
  readUrlContext();
  readContext();

  // Beri tahu aplikasi utama bahwa halaman kamera sudah siap.
  try {
    const target = window.parent !== window ? window.parent : window.opener;
    if (target) {
      target.postMessage(
        { type: "MONITOR_GURU_CAMERA_READY" },
        "*"
      );
    }
  } catch (e) {
    console.warn("Handshake kamera gagal:", e);
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    $("cameraMessage").textContent = "Browser tidak mendukung kamera";
    setStatus("Gunakan browser modern melalui HTTPS.", "error");
  } else {
    openCamera().catch(handleCameraError);
  }

  window.addEventListener("beforeunload", stopCamera);
})();
