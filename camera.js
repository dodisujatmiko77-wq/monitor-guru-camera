(() => {
  "use strict";

  const state = {
    stream: null,
    facingMode: "environment",
    photoData: "",
    payload: null,
    sending: false
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

    // Untuk integrasi aplikasi utama:
    // window.opener menerima hasil dengan postMessage.
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, "*");
      setStatus("Foto berhasil dikirim ke aplikasi utama.");
      setTimeout(() => window.close(), 900);
    } else {
      // Mode mandiri untuk pengujian kamera.
      setStatus("Foto berhasil diambil. Mode tes mandiri aktif.");
      state.sending = false;
      $("confirmBtn").disabled = false;
      $("retakeBtn").disabled = false;
    }
  }

  function readContext() {
    // Konteks dapat dikirim dari aplikasi utama melalui postMessage.
    window.addEventListener("message", event => {
      const data = event.data;
      if (!data || data.type !== "MONITOR_GURU_CAMERA_INIT") return;

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
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      history.back();
    }
  });

  readContext();

  if (!navigator.mediaDevices?.getUserMedia) {
    $("cameraMessage").textContent = "Browser tidak mendukung kamera";
    setStatus("Gunakan browser modern melalui HTTPS.", "error");
  } else {
    openCamera().catch(handleCameraError);
  }

  window.addEventListener("beforeunload", stopCamera);
})();
