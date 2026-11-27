<?php

declare(strict_types=1);

// =========================================
// SILAB - RATE LIMITING LOGIN
// =========================================

function rateLimitLogin(
    string $identifier,
    string $aksi = "check"
): array {

    // Maksimal 5 percobaan dalam 15 menit
    $maksPercobaan = 5;
    $durasiBlokir = 900;

    // Identifikasi akun dan IP
    $ip = $_SERVER["REMOTE_ADDR"] ?? "unknown";

    $key = hash(
        "sha256",
        strtolower(trim($identifier)) . "|" . $ip
    );

    // Penyimpanan di luar folder website
    $direktori = sys_get_temp_dir()
        . DIRECTORY_SEPARATOR
        . "silab_login_rate_limit";

    if (!is_dir($direktori)) {
        if (!mkdir($direktori, 0700, true) && !is_dir($direktori)) {
            error_log("SILAB: Gagal membuat direktori rate limit.");
            return [
                "blocked" => true,
                "retry_after" => 60
            ];
        }
    }

    $file = $direktori
        . DIRECTORY_SEPARATOR
        . $key
        . ".json";

    $handle = fopen($file, "c+");

    if (!$handle) {
        error_log("SILAB: Gagal membuka file rate limit.");

        return [
            "blocked" => true,
            "retry_after" => 60
        ];
    }

    try {

        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException("Gagal mengunci file rate limit.");
        }

        rewind($handle);

        $isi = stream_get_contents($handle);

        $data = json_decode($isi ?: "{}", true);

        if (!is_array($data)) {
            $data = [];
        }

        $sekarang = time();

        $percobaan = array_filter(
            $data["attempts"] ?? [],
            function ($waktu) use ($sekarang, $durasiBlokir) {
                return is_numeric($waktu)
                    && (int) $waktu > $sekarang - $durasiBlokir;
            }
        );

        $percobaan = array_values($percobaan);

        // =====================================
        // RESET SETELAH LOGIN BERHASIL
        // =====================================

        if ($aksi === "reset") {
            $percobaan = [];
        }

        // =====================================
        // CATAT LOGIN GAGAL
        // =====================================

        elseif ($aksi === "failed") {
            $percobaan[] = $sekarang;
        }

        // =====================================
        // HITUNG SISA WAKTU BLOKIR
        // =====================================

        $jumlah = count($percobaan);

        $blocked = $jumlah >= $maksPercobaan;

        $retryAfter = 0;

        if ($blocked) {
            $waktuPertama = (int) $percobaan[0];

            $retryAfter = max(
                1,
                $durasiBlokir - ($sekarang - $waktuPertama)
            );
        }

        // Simpan data terbaru
        rewind($handle);
        ftruncate($handle, 0);

        fwrite(
            $handle,
            json_encode([
                "attempts" => $percobaan,
                "updated_at" => $sekarang
            ])
        );

        fflush($handle);

        flock($handle, LOCK_UN);

        return [
            "blocked" => $blocked,
            "retry_after" => $retryAfter,
            "attempts" => $jumlah
        ];

    } catch (Throwable $e) {

        error_log(
            "SILAB RATE LIMIT ERROR: " . $e->getMessage()
        );

        return [
            "blocked" => true,
            "retry_after" => 60
        ];

    } finally {

        fclose($handle);
    }
}
