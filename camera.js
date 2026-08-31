(() => {
  "use strict";

  /*
   * ============================================================
   * MONITOR GURU CAMERA
   * MEDIAN + BROWSER COMPATIBLE
   *
   * Bisa berjalan sebagai:
   * 1. iframe
   * 2. popup/window.open
   * 3. halaman kamera mandiri
   *
   * Tidak mengubah format hasil foto.
   * ============================================================
   */

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

  /*
   * ============================================================
   * TENTUKAN APLIKASI INDUK
   * ============================================================
   */
  function getParentWindow() {

    // Jika dibuka dengan window.open()
    if (
      window.opener &&
      !window.opener.closed
    ) {
      return window.opener;
    }

    // Jika dibuka sebagai iframe
    if (window.parent && window.parent !== window) {
      return window.parent;
    }

    return null;
  }


  /*
   * ============================================================
   * STATUS
   * ============================================================
   */
  function setStatus(message, type = "") {

    const el = $("status");

    if (el) {
      el.textContent = message || "";
      el.dataset.type = type;
    }
  }


  /*
   * ============================================================
   * STOP CAMERA
   * ============================================================
   */
  function stopCamera() {

    if (state.stream) {

      state.stream
        .getTracks()
        .forEach(track => {

          try {
            track.stop();
          } catch (e) {
            console.warn(
              "Gagal menghentikan track:",
              e
            );
          }

        });

      state.stream = null;
    }

    const video = $("video");

    if (video) {
      video.srcObject = null;
    }
  }


  /*
   * ============================================================
   * OPEN CAMERA
   * ============================================================
   */
  async function openCamera() {

    stopCamera();

    setStatus("Membuka kamera…");

    const cameraMessage =
      $("cameraMessage");

    if (cameraMessage) {
      cameraMessage.textContent =
        "Membuka kamera…";

      cameraMessage.hidden = false;
    }


    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      throw new Error(
        "getUserMedia tidak tersedia"
      );
    }


    let stream = null;
    let firstError = null;


    /*
     * Percobaan pertama:
     * gunakan kamera sesuai facingMode.
     */
    try {

      stream =
        await navigator.mediaDevices
          .getUserMedia({

            video: {

              facingMode: {
                ideal:
                  state.facingMode
              },

              width: {
                ideal: 1280
              },

              height: {
                ideal: 720
              }

            },

            audio: false

          });

    } catch (e) {

      firstError = e;

      console.warn(
        "Kamera dengan facingMode gagal:",
        e
      );
    }


    /*
     * Fallback:
     * minta kamera tanpa constraint.
     *
     * Ini penting untuk beberapa WebView
     * Android/Median.
     */
    if (!stream) {

      try {

        stream =
          await navigator.mediaDevices
            .getUserMedia({

              video: true,
              audio: false

            });

      } catch (e) {

        console.error(
          "Fallback kamera gagal:",
          e
        );

        throw e || firstError;
      }
    }


    state.stream = stream;


    const video = $("video");

    if (!video) {
      throw new Error(
        "Elemen video tidak ditemukan"
      );
    }


    video.srcObject = stream;

    /*
     * Beberapa WebView membutuhkan
     * playsInline agar kamera dapat tampil
     * tanpa fullscreen.
     */
    video.setAttribute(
      "playsinline",
      ""
    );

    video.setAttribute(
      "autoplay",
      ""
    );

    video.muted = true;


    try {

      await video.play();

    } catch (e) {

      console.warn(
        "video.play() tertunda:",
        e
      );

      /*
       * Coba lagi setelah metadata tersedia.
       */
      await new Promise(resolve => {

        const retry = () => {

          video.removeEventListener(
            "loadedmetadata",
            retry
          );

          video.play()
            .catch(() => {})
            .finally(resolve);
        };

        video.addEventListener(
          "loadedmetadata",
          retry
        );

      });
    }


    if (cameraMessage) {
      cameraMessage.hidden = true;
    }


    const captureBtn =
      $("captureBtn");

    if (captureBtn) {
      captureBtn.disabled = false;
    }


    setStatus("Kamera siap.");
  }


  /*
   * ============================================================
   * CAPTURE FOTO
   * ============================================================
   */
  function capture() {

    const video = $("video");

    if (
      !video ||
      !video.videoWidth ||
      !video.videoHeight
    ) {

      setStatus(
        "Kamera belum siap."
      );

      return;
    }


    const canvas = $("canvas");

    if (!canvas) {

      setStatus(
        "Canvas kamera tidak ditemukan.",
        "error"
      );

      return;
    }


    const maxWidth = 1280;

    const scale =
      Math.min(
        1,
        maxWidth /
          video.videoWidth
      );


    canvas.width =
      Math.round(
        video.videoWidth *
        scale
      );

    canvas.height =
      Math.round(
        video.videoHeight *
        scale
      );


    const ctx =
      canvas.getContext(
        "2d",
        {
          alpha: false
        }
      );


    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );


    state.photoData =
      canvas.toDataURL(
        "image/jpeg",
        0.84
      );


    const preview =
      $("preview");

    if (preview) {

      preview.src =
        state.photoData;

      preview.hidden = false;
    }


    if (video) {
      video.hidden = true;
    }


    const guide =
      $("guide");

    if (guide) {
      guide.hidden = true;
    }


    const actions =
      $("actions");

    if (actions) {
      actions.hidden = true;
    }


    const previewActions =
      $("previewActions");

    if (previewActions) {
      previewActions.hidden = false;
    }


    stopCamera();


    setStatus(
      "Periksa foto. Jika sudah benar, konfirmasi."
    );
  }


  /*
   * ============================================================
   * RETAKE
   * ============================================================
   */
  function retake() {

    const preview =
      $("preview");

    if (preview) {
      preview.hidden = true;
    }


    const video =
      $("video");

    if (video) {
      video.hidden = false;
    }


    const guide =
      $("guide");

    if (guide) {
      guide.hidden = false;
    }


    const actions =
      $("actions");

    if (actions) {
      actions.hidden = false;
    }


    const previewActions =
      $("previewActions");

    if (previewActions) {
      previewActions.hidden = true;
    }


    state.photoData = "";

    openCamera()
      .catch(handleCameraError);
  }


  /*
   * ============================================================
   * CAMERA ERROR
   * ============================================================
   */
  function handleCameraError(err) {

    stopCamera();


    const captureBtn =
      $("captureBtn");

    if (captureBtn) {
      captureBtn.disabled = true;
    }


    const cameraMessage =
      $("cameraMessage");

    if (cameraMessage) {

      cameraMessage.hidden = false;

      cameraMessage.textContent =
        "Kamera tidak dapat dibuka";
    }


    const name =
      err?.name ||
      "UnknownError";


    if (
      name ===
      "NotAllowedError"
    ) {

      setStatus(
        "Akses kamera ditolak. Periksa izin kamera Android/Median.",
        "error"
      );

    } else if (
      name ===
      "NotReadableError"
    ) {

      setStatus(
        "Kamera sedang digunakan aplikasi lain.",
        "error"
      );

    } else if (
      name ===
      "NotFoundError"
    ) {

      setStatus(
        "Kamera tidak ditemukan.",
        "error"
      );

    } else if (
      name ===
      "SecurityError"
    ) {

      setStatus(
        "Akses kamera diblokir oleh keamanan halaman/WebView.",
        "error"
      );

    } else {

      setStatus(
        "Kamera gagal dibuka: " +
        name,
        "error"
      );
    }


    console.error(
      "CAMERA ERROR:",
      err
    );
  }


  /*
   * ============================================================
   * CONFIRM PHOTO
   * ============================================================
   */
  async function confirmPhoto() {

    if (
      !state.photoData ||
      state.sending
    ) {
      return;
    }


    state.sending = true;


    const confirmBtn =
      $("confirmBtn");

    const retakeBtn =
      $("retakeBtn");


    if (confirmBtn) {
      confirmBtn.disabled = true;
    }


    if (retakeBtn) {
      retakeBtn.disabled = true;
    }


    setStatus(
      "Mengirim foto…"
    );


    const message = {

      type:
        "MONITOR_GURU_CAMERA_RESULT",

      success: true,

      photoData:
        state.photoData,

      context:
        state.payload || null,

      capturedAt:
        new Date().toISOString()
    };


    /*
     * ========================================================
     * KIRIM KE APLIKASI UTAMA
     *
     * PRIORITAS:
     * 1. window.opener
     * 2. window.parent
     * ========================================================
     */
    const target =
      state.parentWindow ||
      getParentWindow();


    if (target) {

      try {

        /*
         * Gunakan origin yang sudah didapat
         * melalui handshake.
         *
         * Jika belum ada, fallback "*"
         * agar tetap kompatibel dengan
         * aplikasi lama.
         */
        const targetOrigin =
          state.parentOrigin ||
          "*";


        target.postMessage(
          message,
          targetOrigin
        );


        setStatus(
          "Foto berhasil dikirim ke aplikasi utama."
        );


        /*
         * Jika kamera merupakan popup,
         * tutup popup.
         *
         * Jika iframe, jangan window.close()
         * karena browser akan menolaknya.
         */
        if (
          window.opener &&
          !window.opener.closed
        ) {

          setTimeout(
            () => {

              try {
                window.close();
              } catch (e) {
                console.warn(
                  "Popup tidak dapat ditutup:",
                  e
                );
              }

            },
            900
          );

        } else {

          /*
           * Beritahu parent bahwa kamera
           * boleh ditutup/disembunyikan.
           */
          try {

            target.postMessage(
              {
                type:
                  "MONITOR_GURU_CAMERA_CLOSE"
              },
              targetOrigin
            );

          } catch (e) {

            console.warn(
              "Pesan close gagal:",
              e
            );
          }
        }


        return;

      } catch (e) {

        console.error(
          "Gagal mengirim foto:",
          e
        );

        setStatus(
          "Foto gagal dikirim ke aplikasi utama.",
          "error"
        );
      }
    }


    /*
     * ========================================================
     * MODE MANDIRI
     * ========================================================
     */
    setStatus(
      "Foto berhasil diambil. Mode tes mandiri aktif."
    );


    state.sending = false;


    if (confirmBtn) {
      confirmBtn.disabled = false;
    }


    if (retakeBtn) {
      retakeBtn.disabled = false;
    }
  }


  /*
   * ============================================================
   * READ CONTEXT
   * ============================================================
   */
  function readContext() {

    /*
     * Tentukan parent dari awal.
     */
    state.parentWindow =
      getParentWindow();


    /*
     * Terima pesan dari aplikasi utama.
     */
    window.addEventListener(
      "message",
      event => {

        const data =
          event.data;


        if (
          !data ||
          data.type !==
            "MONITOR_GURU_CAMERA_INIT"
        ) {
          return;
        }


        /*
         * Simpan origin pengirim.
         *
         * Ini lebih aman daripada selalu
         * menggunakan "*".
         */
        state.parentOrigin =
          event.origin;


        state.parentWindow =
          event.source ||
          state.parentWindow;


        state.payload =
          data.context ||
          null;


        const c =
          state.payload ||
          {};


        const teacherName =
          $("teacherName");

        if (teacherName) {
          teacherName.textContent =
            c.namaGuru ||
            "—";
        }


        const className =
          $("className");

        if (className) {
          className.textContent =
            c.kelas ||
            "—";
        }


        const subjectName =
          $("subjectName");

        if (subjectName) {
          subjectName.textContent =
            c.mataPelajaran ||
            "—";
        }


        const scheduleTime =
          $("scheduleTime");

        if (scheduleTime) {

          scheduleTime.textContent =
            c.jamMulai &&
            c.jamSelesai

              ? `${c.jamMulai} - ${c.jamSelesai}`

              : "—";
        }


        console.log(
          "CAMERA INIT RECEIVED:",
          {
            origin:
              event.origin,

            context:
              state.payload
          }
        );
      }
    );
  }


  /*
   * ============================================================
   * SWITCH CAMERA
   * ============================================================
   */
  function switchCamera() {

    state.facingMode =
      state.facingMode ===
      "environment"

        ? "user"

        : "environment";


    openCamera()
      .catch(handleCameraError);
  }


  /*
   * ============================================================
   * CLOSE
   * ============================================================
   */
  function closeCamera() {

    stopCamera();


    /*
     * Popup
     */
    if (
      window.opener &&
      !window.opener.closed
    ) {

      try {
        window.close();
      } catch (e) {
        console.warn(
          "Popup tidak dapat ditutup:",
          e
        );
      }

      return;
    }


    /*
     * Iframe
     */
    const parent =
      state.parentWindow ||
      getParentWindow();


    if (parent) {

      try {

        parent.postMessage(
          {
            type:
              "MONITOR_GURU_CAMERA_CLOSE"
          },
          state.parentOrigin ||
          "*"
        );

        return;

      } catch (e) {

        console.warn(
          "Gagal mengirim close ke parent:",
          e
        );
      }
    }


    /*
     * Mode mandiri
     */
    try {
      history.back();
    } catch (e) {
      console.warn(
        "history.back gagal:",
        e
      );
    }
  }


  /*
   * ============================================================
   * EVENT LISTENER
   * ============================================================
   */
  const captureBtn =
    $("captureBtn");

  if (captureBtn) {
    captureBtn.addEventListener(
      "click",
      capture
    );
  }


  const retakeBtn =
    $("retakeBtn");

  if (retakeBtn) {
    retakeBtn.addEventListener(
      "click",
      retake
    );
  }


  const confirmBtn =
    $("confirmBtn");

  if (confirmBtn) {
    confirmBtn.addEventListener(
      "click",
      confirmPhoto
    );
  }


  const switchBtn =
    $("switchBtn");

  if (switchBtn) {
    switchBtn.addEventListener(
      "click",
      switchCamera
    );
  }


  const closeBtn =
    $("closeBtn");

  if (closeBtn) {
    closeBtn.addEventListener(
      "click",
      closeCamera
    );
  }


  /*
   * ============================================================
   * INIT
   * ============================================================
   */
  readContext();


  /*
   * ============================================================
   * CAMERA READY HANDSHAKE
   * ============================================================
   */
  const initialParent =
    getParentWindow();


  if (initialParent) {

    state.parentWindow =
      initialParent;


    try {

      initialParent.postMessage(
        {
          type:
            "MONITOR_GURU_CAMERA_READY"
        },
        "*"
      );

    } catch (e) {

      console.warn(
        "Handshake kamera gagal:",
        e
      );
    }
  }


  /*
   * ============================================================
   * START CAMERA
   * ============================================================
   */
  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    const cameraMessage =
      $("cameraMessage");

    if (cameraMessage) {

      cameraMessage.textContent =
        "Browser/WebView tidak mendukung kamera";
    }


    setStatus(
      "Gunakan halaman HTTPS dan WebView yang mendukung kamera.",
      "error"
    );

  } else {

    openCamera()
      .catch(handleCameraError);
  }


  /*
   * ============================================================
   * CLEANUP
   * ============================================================
   */
  window.addEventListener(
    "beforeunload",
    stopCamera
  );

})();
