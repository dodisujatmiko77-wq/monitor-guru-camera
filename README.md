# Monitor Guru Camera Module

Modul kamera terpisah untuk aplikasi Monitor Guru.

## Struktur
- index.html
- style.css
- camera.js

## Fungsi tahap awal
1. Membuka kamera pada halaman HTTPS biasa.
2. Mencoba kamera belakang (`environment`) secara longgar.
3. Fallback ke kamera apa pun.
4. Ambil foto.
5. Preview.
6. Foto ulang.
7. Konfirmasi.
8. Mengirim hasil ke window induk melalui `postMessage`.

## Tes mandiri
Buka `index.html` melalui hosting HTTPS seperti GitHub Pages.
Jangan membuka dari `file://`, karena akses kamera membutuhkan secure context.

## Integrasi dengan aplikasi utama
Aplikasi utama dapat membuka halaman kamera di tab/window baru lalu mengirim:

window baru menerima:
{
  type: "MONITOR_GURU_CAMERA_INIT",
  context: {
    scheduleId: "...",
    namaGuru: "...",
    kelas: "...",
    mataPelajaran: "...",
    jamMulai: "...",
    jamSelesai: "..."
  }
}

Setelah foto dikonfirmasi, kamera mengirim ke opener:

{
  type: "MONITOR_GURU_CAMERA_RESULT",
  success: true,
  photoData: "data:image/jpeg;base64,...",
  context: {...},
  capturedAt: "..."
}

PENTING:
- Saat integrasi produksi, jangan mempercayai context dari browser.
- Google Apps Script tetap melakukan validasi session, ScheduleID, guru, jadwal aktif, waktu server, dan menyimpan foto.
- Jangan menaruh token rahasia atau credential backend di GitHub Pages.
