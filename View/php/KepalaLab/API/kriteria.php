<?php

declare(strict_types=1);

// =============================================
// SILAB - API MANAJEMEN KRITERIA
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
// VALIDASI AKSES KEPALA LAB
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
        "Akses ditolak. Hanya Kepala Lab yang dapat mengelola kriteria.",
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

try {

    // =========================================
    // 1. MENAMPILKAN DATA KRITERIA
    // =========================================

    if ($method === "GET" || $action === "list") {

        $idAturan = $_GET["id_aturan"] ?? null;

        if ($idAturan !== null && $idAturan !== "") {

            if (!validId($idAturan)) {
                jsonResponse(
                    false,
                    "ID kelompok aturan tidak valid.",
                    [],
                    422
                );
            }

            $stmt = $pdo->prepare("
                SELECT
                    id_aturan_kriteria,
                    id_aturan,
                    nama_kriteria,
                    bobot,
                    waktu_dibuat,
                    catatan
                FROM aturan_kriteria
                WHERE id_aturan = :id
                ORDER BY id_aturan_kriteria ASC
            ");

            $stmt->execute([
                ":id" => (int) $idAturan
            ]);

        } else {

            $stmt = $pdo->query("
                SELECT
                    id_aturan_kriteria,
                    id_aturan,
                    nama_kriteria,
                    bobot,
                    waktu_dibuat,
                    catatan
                FROM aturan_kriteria
                ORDER BY id_aturan ASC,
                         id_aturan_kriteria ASC
            ");
        }

        jsonResponse(
            true,
            "Data kriteria berhasil diambil.",
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
    // 2. TAMBAH KRITERIA
    // =========================================

    if ($action === "create") {

        $idAturan = $input["id_aturan"] ?? "";
        $name = trim($input["nama_kriteria"] ?? "");
        $note = trim($input["catatan"] ?? "");

        if (!validId($idAturan)) {
            jsonResponse(
                false,
                "ID kelompok aturan tidak valid.",
                [],
                422
            );
        }

        if ($name === "" || strlen($name) > 100) {
            jsonResponse(
                false,
                "Nama kriteria wajib diisi dan maksimal 100 karakter.",
                [],
                422
            );
        }

        $check = $pdo->prepare("
            SELECT id_aturan
            FROM aturan
            WHERE id_aturan = :id
        ");

        $check->execute([
            ":id" => (int) $idAturan
        ]);

        if (!$check->fetch()) {
            jsonResponse(
                false,
                "Kelompok aturan tidak ditemukan.",
                [],
                404
            );
        }

        $check = $pdo->prepare("
            SELECT id_aturan_kriteria
            FROM aturan_kriteria
            WHERE id_aturan = :id
            AND LOWER(nama_kriteria) = LOWER(:nama)
        ");

        $check->execute([
            ":id" => (int) $idAturan,
            ":nama" => $name
        ]);

        if ($check->fetch()) {
            jsonResponse(
                false,
                "Nama kriteria sudah digunakan dalam kelompok ini.",
                [],
                409
            );
        }

        $stmt = $pdo->prepare("
            INSERT INTO aturan_kriteria (
                id_aturan,
                nama_kriteria,
                bobot,
                catatan
            ) VALUES (
                :id_aturan,
                :nama,
                0,
                :catatan
            )
        ");

        $stmt->execute([
            ":id_aturan" => (int) $idAturan,
            ":nama" => $name,
            ":catatan" => $note
        ]);

        jsonResponse(
            true,
            "Kriteria berhasil ditambahkan.",
            [
                "id_aturan_kriteria" => $pdo->lastInsertId()
            ],
            201
        );
    }

    // =========================================
    // 3. EDIT KRITERIA
    // =========================================

    if ($action === "update") {

        $id = $input["id_aturan_kriteria"] ?? "";
        $name = trim($input["nama_kriteria"] ?? "");
        $note = trim($input["catatan"] ?? "");

        if (!validId($id)) {
            jsonResponse(
                false,
                "ID kriteria tidak valid.",
                [],
                422
            );
        }

        if ($name === "" || strlen($name) > 100) {
            jsonResponse(
                false,
                "Nama kriteria wajib diisi dan maksimal 100 karakter.",
                [],
                422
            );
        }

        $check = $pdo->prepare("
            SELECT id_aturan
            FROM aturan_kriteria
            WHERE id_aturan_kriteria = :id
        ");

        $check->execute([
            ":id" => (int) $id
        ]);

        $current = $check->fetch(PDO::FETCH_ASSOC);

        if (!$current) {
            jsonResponse(
                false,
                "Kriteria tidak ditemukan.",
                [],
                404
            );
        }

        $check = $pdo->prepare("
            SELECT id_aturan_kriteria
            FROM aturan_kriteria
            WHERE id_aturan = :id_aturan
            AND LOWER(nama_kriteria) = LOWER(:nama)
            AND id_aturan_kriteria != :id
        ");

        $check->execute([
            ":id_aturan" => (int) $current["id_aturan"],
            ":nama" => $name,
            ":id" => (int) $id
        ]);

        if ($check->fetch()) {
            jsonResponse(
                false,
                "Nama kriteria sudah digunakan dalam kelompok ini.",
                [],
                409
            );
        }

        $stmt = $pdo->prepare("
            UPDATE aturan_kriteria
            SET
                nama_kriteria = :nama,
                catatan = :catatan
            WHERE id_aturan_kriteria = :id
        ");

        $stmt->execute([
            ":nama" => $name,
            ":catatan" => $note,
            ":id" => (int) $id
        ]);

        jsonResponse(
            true,
            "Kriteria berhasil diperbarui."
        );
    }

    // =========================================
    // 4. HAPUS KRITERIA
    // =========================================

    if ($action === "delete") {

        $id = $input["id_aturan_kriteria"] ?? "";

        if (!validId($id)) {
            jsonResponse(
                false,
                "ID kriteria tidak valid.",
                [],
                422
            );
        }

        $stmt = $pdo->prepare("
            DELETE FROM aturan_kriteria
            WHERE id_aturan_kriteria = :id
        ");

        $stmt->execute([
            ":id" => (int) $id
        ]);

        if ($stmt->rowCount() === 0) {
            jsonResponse(
                false,
                "Kriteria tidak ditemukan.",
                [],
                404
            );
        }

        jsonResponse(
            true,
            "Kriteria berhasil dihapus."
        );
    }

    // =========================================
    // 5. SIMPAN BOBOT KRITERIA
    // =========================================

    if ($action === "save_weights") {

        $idAturan = $input["id_aturan"] ?? "";
        $weights = $input["weights"] ?? [];

        if (!validId($idAturan)) {
            jsonResponse(
                false,
                "ID kelompok aturan tidak valid.",
                [],
                422
            );
        }

        if (!is_array($weights) || count($weights) === 0) {
            jsonResponse(
                false,
                "Data bobot kriteria belum tersedia.",
                [],
                422
            );
        }

        $normalized = [];
        $total = 0;

        foreach ($weights as $item) {

            $id = $item["id_aturan_kriteria"] ?? "";
            $weight = $item["bobot"] ?? "";

            if (!validId($id) || !validWeight($weight)) {
                jsonResponse(
                    false,
                    "ID atau bobot kriteria tidak valid.",
                    [],
                    422
                );
            }

            $id = (int) $id;
            $weight = round((float) $weight, 2);

            if (isset($normalized[$id])) {
                jsonResponse(
                    false,
                    "Kriteria tidak boleh dikirim berulang.",
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
                "Total bobot kriteria harus tepat 100%. Total saat ini: {$total}%.",
                ["total" => $total],
                422
            );
        }

        // Pastikan semua kriteria kelompok dikirim.
        $stmt = $pdo->prepare("
            SELECT id_aturan_kriteria
            FROM aturan_kriteria
            WHERE id_aturan = :id
        ");

        $stmt->execute([
            ":id" => (int) $idAturan
        ]);

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
                "Daftar kriteria berubah. Muat ulang halaman sebelum menyimpan.",
                [],
                409
            );
        }

        $pdo->beginTransaction();

        try {

            $update = $pdo->prepare("
                UPDATE aturan_kriteria
                SET bobot = :bobot
                WHERE id_aturan_kriteria = :id
                AND id_aturan = :id_aturan
            ");

            foreach ($normalized as $id => $weight) {

                $update->execute([
                    ":bobot" => $weight,
                    ":id" => $id,
                    ":id_aturan" => (int) $idAturan
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
            "Seluruh bobot kriteria berhasil disimpan.",
            ["total" => 100]
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

    error_log("API KRITERIA DATABASE ERROR: " . $e->getMessage());

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if ($e->getCode() === "23000") {
        jsonResponse(
            false,
            "Data kriteria tidak dapat diproses karena masih memiliki relasi.",
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

    error_log("API KRITERIA ERROR: " . $e->getMessage());

    jsonResponse(
        false,
        "Terjadi kesalahan pada sistem.",
        [],
        500
    );
}
