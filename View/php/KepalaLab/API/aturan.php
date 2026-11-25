<?php

declare(strict_types=1);

// =============================================
// SILAB - API MANAJEMEN ATURAN
// =============================================

require_once __DIR__ . "/../../auth/sesi.php";
require_once __DIR__ . "/../../../config/database.php";

header("Content-Type: application/json; charset=UTF-8");

// =============================================
// RESPONS JSON
// =============================================

function jsonResponse(
    bool $success,
    string $message,
    array $data = [],
    int $httpCode = 200
): void {
    http_response_code($httpCode);

    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

// =============================================
// VALIDASI AKSES
// =============================================

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (
    empty($_SESSION["login"]) ||
    ($_SESSION["role"] ?? "") !== "kepala_lab"
) {
    jsonResponse(
        false,
        "Akses ditolak. Hanya Kepala Lab yang dapat mengelola aturan.",
        [],
        403
    );
}

// =============================================
// FUNGSI BANTU
// =============================================

function getInput(): array
{
    $contentType = $_SERVER["CONTENT_TYPE"] ?? "";

    if (stripos($contentType, "application/json") !== false) {
        $input = json_decode(
            file_get_contents("php://input"),
            true
        );

        return is_array($input) ? $input : [];
    }

    return $_POST;
}

function validId($value): bool
{
    return filter_var(
        $value,
        FILTER_VALIDATE_INT,
        ["options" => ["min_range" => 1]]
    ) !== false;
}

function validWeight($value): bool
{
    return is_numeric($value)
        && is_finite((float) $value)
        && (float) $value >= 0
        && (float) $value <= 100;
}

// =============================================
// ACTION
// =============================================

$method = $_SERVER["REQUEST_METHOD"];
$input = getInput();
$action = $input["action"] ?? $_GET["action"] ?? "";

// =============================================
// PROSES API
// =============================================

try {

    // =========================================
    // 1. MENAMPILKAN KELOMPOK ATURAN
    // =========================================

    if ($method === "GET" || $action === "list") {

        $stmt = $pdo->query("
            SELECT
                id_aturan,
                nama_kelompok,
                bobot,
                waktu_dibuat,
                catatan
            FROM aturan
            ORDER BY id_aturan ASC
        ");

        jsonResponse(
            true,
            "Data kelompok aturan berhasil diambil.",
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        );
    }

    if ($method !== "POST") {
        jsonResponse(
            false,
            "Metode permintaan tidak diizinkan.",
            [],
            405
        );
    }

    // =========================================
    // 2. TAMBAH KELOMPOK ATURAN
    // =========================================

    if ($action === "create") {

        $name = trim($input["nama_kelompok"] ?? "");
        $note = trim($input["catatan"] ?? "");

        if ($name === "") {
            jsonResponse(
                false,
                "Nama kelompok aturan wajib diisi.",
                [],
                422
            );
        }

        $check = $pdo->prepare("
            SELECT id_aturan
            FROM aturan
            WHERE LOWER(nama_kelompok) = LOWER(:nama)
        ");

        $check->execute([":nama" => $name]);

        if ($check->fetch()) {
            jsonResponse(
                false,
                "Nama kelompok aturan sudah digunakan.",
                [],
                409
            );
        }

        $stmt = $pdo->prepare("
            INSERT INTO aturan (
                nama_kelompok,
                bobot,
                catatan
            ) VALUES (
                :nama,
                0,
                :catatan
            )
        ");

        $stmt->execute([
            ":nama" => $name,
            ":catatan" => $note
        ]);

        jsonResponse(
            true,
            "Kelompok aturan berhasil ditambahkan.",
            [
                "id_aturan" => $pdo->lastInsertId()
            ],
            201
        );
    }

    // =========================================
    // 3. EDIT KELOMPOK ATURAN
    // =========================================

    if ($action === "update") {

        $id = $input["id_aturan"] ?? "";
        $name = trim($input["nama_kelompok"] ?? "");
        $note = trim($input["catatan"] ?? "");

        if (!validId($id)) {
            jsonResponse(false, "ID aturan tidak valid.", [], 422);
        }

        if ($name === "") {
            jsonResponse(
                false,
                "Nama kelompok aturan wajib diisi.",
                [],
                422
            );
        }

        $check = $pdo->prepare("
            SELECT id_aturan
            FROM aturan
            WHERE LOWER(nama_kelompok) = LOWER(:nama)
            AND id_aturan != :id
        ");

        $check->execute([
            ":nama" => $name,
            ":id" => (int) $id
        ]);

        if ($check->fetch()) {
            jsonResponse(
                false,
                "Nama kelompok aturan sudah digunakan.",
                [],
                409
            );
        }

        $stmt = $pdo->prepare("
            UPDATE aturan
            SET
                nama_kelompok = :nama,
                catatan = :catatan
            WHERE id_aturan = :id
        ");

        $stmt->execute([
            ":nama" => $name,
            ":catatan" => $note,
            ":id" => (int) $id
        ]);

        $check = $pdo->prepare("
            SELECT id_aturan
            FROM aturan
            WHERE id_aturan = :id
        ");

        $check->execute([":id" => (int) $id]);

        if (!$check->fetch()) {
            jsonResponse(
                false,
                "Kelompok aturan tidak ditemukan.",
                [],
                404
            );
        }

        jsonResponse(
            true,
            "Kelompok aturan berhasil diperbarui."
        );
    }

    // =========================================
    // 4. HAPUS KELOMPOK ATURAN
    // =========================================

    if ($action === "delete") {

        $id = $input["id_aturan"] ?? "";

        if (!validId($id)) {
            jsonResponse(false, "ID aturan tidak valid.", [], 422);
        }

        $check = $pdo->prepare("
            SELECT id_aturan
            FROM aturan
            WHERE id_aturan = :id
        ");

        $check->execute([":id" => (int) $id]);

        if (!$check->fetch()) {
            jsonResponse(
                false,
                "Kelompok aturan tidak ditemukan.",
                [],
                404
            );
        }

        $stmt = $pdo->prepare("
            DELETE FROM aturan
            WHERE id_aturan = :id
        ");

        $stmt->execute([":id" => (int) $id]);

        jsonResponse(
            true,
            "Kelompok aturan dan seluruh kriterianya berhasil dihapus."
        );
    }

    // =========================================
    // 5. SIMPAN SELURUH BOBOT KELOMPOK
    // =========================================

    if ($action === "save_weights") {

        $weights = $input["weights"] ?? [];

        if (!is_array($weights) || count($weights) === 0) {
            jsonResponse(
                false,
                "Data bobot kelompok belum tersedia.",
                [],
                422
            );
        }

        $normalized = [];
        $total = 0;

        foreach ($weights as $item) {

            $id = $item["id_aturan"] ?? "";
            $weight = $item["bobot"] ?? "";

            if (!validId($id) || !validWeight($weight)) {
                jsonResponse(
                    false,
                    "ID atau bobot kelompok tidak valid.",
                    [],
                    422
                );
            }

            $id = (int) $id;
            $weight = round((float) $weight, 2);

            if (isset($normalized[$id])) {
                jsonResponse(
                    false,
                    "Kelompok aturan tidak boleh dikirim berulang.",
                    [],
                    422
                );
            }

            $normalized[$id] = $weight;
            $total += $weight;
        }

        $total = round($total, 2);

        if ($total !== 100.00) {
            jsonResponse(
                false,
                "Total bobot seluruh kelompok harus tepat 100%. Total saat ini: {$total}%.",
                ["total" => $total],
                422
            );
        }

        // Pastikan semua kelompok database dikirim.
        $stmt = $pdo->query("
            SELECT id_aturan
            FROM aturan
        ");

        $databaseIds = array_map(
            "intval",
            $stmt->fetchAll(PDO::FETCH_COLUMN)
        );

        $submittedIds = array_keys($normalized);

        sort($databaseIds);
        sort($submittedIds);

        if ($databaseIds !== $submittedIds) {
            jsonResponse(
                false,
                "Daftar kelompok berubah. Muat ulang halaman sebelum menyimpan.",
                [],
                409
            );
        }

        $pdo->beginTransaction();

        try {

            $update = $pdo->prepare("
                UPDATE aturan
                SET bobot = :bobot
                WHERE id_aturan = :id
            ");

            foreach ($normalized as $id => $weight) {
                $update->execute([
                    ":bobot" => $weight,
                    ":id" => $id
                ]);
            }

            $pdo->commit();

        } catch (Throwable $e) {

            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }

        jsonResponse(
            true,
            "Seluruh bobot kelompok aturan berhasil disimpan.",
            ["total" => 100]
        );
    }

    // =========================================
    // 6. SIMPAN SELURUH BOBOT UTAMA SILAB
    // =========================================

    if ($action === "save_main_weights") {

        $weights = $input["weights"] ?? [];
        $facilityWeight = $input["bobot_utama_fasilitas"] ?? "";

        if (!is_array($weights) || count($weights) === 0) {
            jsonResponse(
                false,
                "Data bobot kelompok belum tersedia.",
                [],
                422
            );
        }

        if (!validWeight($facilityWeight)) {
            jsonResponse(
                false,
                "Bobot utama fasilitas tidak valid.",
                [],
                422
            );
        }

        $normalized = [];
        $total = 0;

        foreach ($weights as $item) {

            $id = $item["id_aturan"] ?? "";
            $weight = $item["bobot"] ?? "";

            if (!validId($id) || !validWeight($weight)) {
                jsonResponse(
                    false,
                    "ID atau bobot kelompok tidak valid.",
                    [],
                    422
                );
            }

            $id = (int) $id;
            $weight = round((float) $weight, 2);

            if (isset($normalized[$id])) {
                jsonResponse(
                    false,
                    "Kelompok aturan dikirim berulang.",
                    [],
                    422
                );
            }

            $normalized[$id] = $weight;
            $total += $weight;
        }

        $facilityWeight = round((float) $facilityWeight, 2);

        $total = round($total + $facilityWeight, 2);

        if ($total !== 100.00) {
            jsonResponse(
                false,
                "Total bobot utama harus tepat 100%. Total saat ini: {$total}%.",
                ["total" => $total],
                422
            );
        }

        // Pastikan semua kelompok aturan dikirim.
        $stmt = $pdo->query("
            SELECT id_aturan
            FROM aturan
        ");

        $databaseIds = array_map(
            "intval",
            $stmt->fetchAll(PDO::FETCH_COLUMN)
        );

        $submittedIds = array_keys($normalized);

        sort($databaseIds);
        sort($submittedIds);

        if ($databaseIds !== $submittedIds) {
            jsonResponse(
                false,
                "Daftar kelompok aturan berubah. Silakan refresh halaman.",
                [],
                409
            );
        }

        // Pastikan fasilitas tersedia.
        $facilityCount = (int) $pdo->query("
            SELECT COUNT(*) FROM fasilitas
        ")->fetchColumn();

        if ($facilityCount === 0) {
            jsonResponse(
                false,
                "Tambahkan minimal satu fasilitas sebelum menyimpan bobot utama.",
                [],
                422
            );
        }

        // Simpan kedua bobot dalam satu transaksi.
        $pdo->beginTransaction();

        try {

            $updateRule = $pdo->prepare("
                UPDATE aturan
                SET bobot = :bobot
                WHERE id_aturan = :id
            ");

            foreach ($normalized as $id => $weight) {
                $updateRule->execute([
                    ":bobot" => $weight,
                    ":id" => $id
                ]);
            }

            // Bobot utama fasilitas dibuat sama
            // pada seluruh baris fasilitas.
            $updateFacility = $pdo->prepare("
                UPDATE fasilitas
                SET bobot_utama = :bobot
            ");

            $updateFacility->execute([
                ":bobot" => $facilityWeight
            ]);

            $pdo->commit();

        } catch (Throwable $e) {

            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }

        jsonResponse(
            true,
            "Seluruh bobot utama berhasil disimpan.",
            [
                "total" => 100,
                "bobot_utama_fasilitas" => $facilityWeight
            ]
        );
    }

    // =========================================
    // ACTION TIDAK DIKENALI
    // =========================================

    jsonResponse(
        false,
        "Aksi API tidak dikenali.",
        [],
        400
    );

} catch (PDOException $e) {

    error_log("API ATURAN DATABASE ERROR: " . $e->getMessage());

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if ($e->getCode() === "23000") {
        jsonResponse(
            false,
            "Kelompok aturan tidak dapat dihapus karena masih digunakan oleh data lain.",
            [],
            409
        );
    }

    jsonResponse(
        false,
        "Terjadi kesalahan pada database.",
        [],
        500
    );

} catch (Throwable $e) {

    error_log("API ATURAN ERROR: " . $e->getMessage());

    jsonResponse(
        false,
        "Terjadi kesalahan pada sistem.",
        [],
        500
    );
}
