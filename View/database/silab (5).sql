-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 27, 2026 at 01:09 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `silab`
--

-- --------------------------------------------------------

--
-- Table structure for table `alternatif_rekomendasi`
--

CREATE TABLE `alternatif_rekomendasi` (
  `id_alternatif_rekomendasi` bigint(20) UNSIGNED NOT NULL,
  `id_rekomendasi` bigint(20) UNSIGNED NOT NULL,
  `waktu_mulai` datetime NOT NULL,
  `waktu_selesai` datetime NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'Menunggu'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `aturan`
--

CREATE TABLE `aturan` (
  `id_aturan` bigint(20) UNSIGNED NOT NULL,
  `nama_kelompok` varchar(100) NOT NULL,
  `bobot` decimal(5,2) NOT NULL DEFAULT 0.00,
  `waktu_dibuat` datetime NOT NULL DEFAULT current_timestamp(),
  `catatan` text DEFAULT NULL
) ;

--
-- Dumping data for table `aturan`
--

INSERT INTO `aturan` (`id_aturan`, `nama_kelompok`, `bobot`, `waktu_dibuat`, `catatan`) VALUES
(1, 'Kategori Kegiatan', 50.00, '2026-11-19 05:57:35', '');

-- --------------------------------------------------------

--
-- Table structure for table `aturan_kriteria`
--

CREATE TABLE `aturan_kriteria` (
  `id_aturan_kriteria` bigint(20) UNSIGNED NOT NULL,
  `id_aturan` bigint(20) UNSIGNED NOT NULL,
  `nama_kriteria` varchar(100) NOT NULL,
  `bobot` decimal(5,2) NOT NULL DEFAULT 0.00,
  `waktu_dibuat` datetime NOT NULL DEFAULT current_timestamp(),
  `catatan` text DEFAULT NULL
) ;

--
-- Dumping data for table `aturan_kriteria`
--

INSERT INTO `aturan_kriteria` (`id_aturan_kriteria`, `id_aturan`, `nama_kriteria`, `bobot`, `waktu_dibuat`, `catatan`) VALUES
(7, 1, 'Kelas Pengganti', 40.00, '2026-11-27 08:06:53', ''),
(8, 1, 'Rapat Asisten', 30.00, '2026-11-27 08:07:06', ''),
(9, 1, 'HMTI', 20.00, '2026-11-27 08:07:18', ''),
(10, 1, 'Belajar Mandiri', 10.00, '2026-11-27 08:07:33', '');

-- --------------------------------------------------------

--
-- Table structure for table `booking`
--

CREATE TABLE `booking` (
  `id_booking` bigint(20) UNSIGNED NOT NULL,
  `id_pengajuan` bigint(20) UNSIGNED NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'Menunggu',
  `waktu_dibuat` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `booking`
--

INSERT INTO `booking` (`id_booking`, `id_pengajuan`, `status`, `waktu_dibuat`) VALUES
(1, 1, 'Disetujui', '2026-09-26 10:00:00'),
(2, 2, 'Disetujui', '2026-09-27 12:15:00'),
(3, 3, 'Disetujui', '2026-09-28 10:45:00'),
(4, 4, 'Disetujui', '2026-09-30 12:15:00'),
(5, 5, 'Disetujui', '2026-10-01 12:45:00'),
(6, 6, 'Disetujui', '2026-10-02 13:00:00'),
(7, 7, 'Disetujui', '2026-10-03 15:30:00'),
(8, 8, 'Disetujui', '2026-10-05 14:00:00'),
(9, 9, 'Disetujui', '2026-10-06 14:30:00'),
(10, 10, 'Disetujui', '2026-10-07 16:00:00'),
(11, 11, 'Disetujui', '2026-10-08 13:30:00'),
(12, 12, 'Disetujui', '2026-10-09 10:00:00'),
(13, 13, 'Disetujui', '2026-10-11 10:15:00'),
(14, 14, 'Disetujui', '2026-10-12 13:45:00'),
(15, 15, 'Disetujui', '2026-10-13 14:30:00'),
(16, 16, 'Disetujui', '2026-10-14 10:15:00'),
(17, 17, 'Disetujui', '2026-10-16 16:45:00'),
(18, 18, 'Disetujui', '2026-10-17 14:00:00'),
(19, 19, 'Disetujui', '2026-10-18 15:30:00'),
(20, 20, 'Disetujui', '2026-10-19 14:15:00'),
(21, 21, 'Disetujui', '2026-10-20 16:15:00'),
(22, 22, 'Disetujui', '2026-10-22 13:45:00'),
(23, 23, 'Disetujui', '2026-10-23 12:15:00'),
(24, 24, 'Disetujui', '2026-10-24 09:00:00'),
(25, 25, 'Disetujui', '2026-10-25 15:00:00'),
(26, 26, 'Disetujui', '2026-10-27 16:30:00'),
(27, 27, 'Disetujui', '2026-10-28 10:30:00'),
(28, 28, 'Disetujui', '2026-10-29 13:45:00'),
(29, 29, 'Disetujui', '2026-10-30 13:15:00'),
(30, 30, 'Disetujui', '2026-11-01 13:15:00'),
(31, 31, 'Disetujui', '2026-11-02 09:30:00'),
(32, 32, 'Disetujui', '2026-11-03 14:30:00'),
(33, 33, 'Disetujui', '2026-11-04 10:00:00'),
(34, 34, 'Disetujui', '2026-11-05 11:15:00'),
(35, 35, 'Disetujui', '2026-11-07 11:30:00'),
(36, 51, 'digunakan', '2026-11-27 08:11:07');

-- --------------------------------------------------------

--
-- Table structure for table `fasilitas`
--

CREATE TABLE `fasilitas` (
  `id_fasilitas` bigint(20) UNSIGNED NOT NULL,
  `nama_fasilitas` varchar(100) NOT NULL,
  `kapasitas_maksimum` int(11) NOT NULL,
  `bobot` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tanggal_dibuat` datetime NOT NULL DEFAULT current_timestamp(),
  `deskripsi` text DEFAULT NULL,
  `bobot_utama` decimal(5,2) NOT NULL DEFAULT 0.00
) ;

--
-- Dumping data for table `fasilitas`
--

INSERT INTO `fasilitas` (`id_fasilitas`, `nama_fasilitas`, `kapasitas_maksimum`, `bobot`, `tanggal_dibuat`, `deskripsi`, `bobot_utama`) VALUES
(2, 'Proyektor', 25, 50.00, '2026-11-18 19:11:28', 'dsa', 50.00),
(4, 'PC', 32, 30.00, '2026-11-19 06:44:16', 'ds', 50.00),
(5, 'Mouse', 20, 15.00, '2026-11-19 17:36:34', '', 50.00),
(6, 'keyboard', 20, 5.00, '2026-11-20 14:35:15', '', 50.00);

-- --------------------------------------------------------

--
-- Table structure for table `konflik`
--

CREATE TABLE `konflik` (
  `id_konflik` bigint(20) UNSIGNED NOT NULL,
  `id_user_laboran` bigint(20) UNSIGNED NOT NULL,
  `id_pengajuan_terpilih` bigint(20) UNSIGNED DEFAULT NULL,
  `id_user_kepala_lab` bigint(20) UNSIGNED DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'Menunggu',
  `waktu_dibuat` datetime NOT NULL DEFAULT current_timestamp(),
  `waktu_dikirim` datetime DEFAULT NULL,
  `waktu_ditetapkan` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pengajuan`
--

CREATE TABLE `pengajuan` (
  `id_pengajuan` bigint(20) UNSIGNED NOT NULL,
  `id_user` bigint(20) UNSIGNED NOT NULL,
  `nama_kegiatan` varchar(150) NOT NULL,
  `waktu_mulai` datetime NOT NULL,
  `waktu_selesai` datetime NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'Menunggu',
  `waktu_dibuat` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pengajuan`
--

INSERT INTO `pengajuan` (`id_pengajuan`, `id_user`, `nama_kegiatan`, `waktu_mulai`, `waktu_selesai`, `status`, `waktu_dibuat`) VALUES
(1, 3, 'Praktikum Pemrograman Dasar', '2026-10-08 10:00:00', '2026-10-08 12:00:00', 'Disetujui', '2026-09-26 09:00:00'),
(2, 4, 'Praktikum Basis Data', '2026-10-09 08:00:00', '2026-10-09 12:00:00', 'Disetujui', '2026-09-27 11:15:00'),
(3, 5, 'Praktikum Jaringan Komputer', '2026-09-29 08:00:00', '2026-09-29 10:00:00', 'Disetujui', '2026-09-28 09:45:00'),
(4, 6, 'Praktikum Sistem Operasi', '2026-10-09 14:00:00', '2026-10-09 16:00:00', 'Disetujui', '2026-09-30 11:15:00'),
(5, 7, 'Praktikum Multimedia', '2026-10-05 13:00:00', '2026-10-05 17:00:00', 'Disetujui', '2026-10-01 11:45:00'),
(6, 8, 'Pelatihan Desain Grafis', '2026-10-15 09:00:00', '2026-10-15 13:00:00', 'Disetujui', '2026-10-02 12:00:00'),
(7, 9, 'Workshop Internet of Things', '2026-10-08 09:00:00', '2026-10-08 11:00:00', 'Disetujui', '2026-10-03 14:30:00'),
(8, 10, 'Seminar Teknologi Informasi', '2026-10-07 13:00:00', '2026-10-07 15:00:00', 'Disetujui', '2026-10-05 13:00:00'),
(9, 11, 'Uji Kompetensi Komputer', '2026-10-16 10:00:00', '2026-10-16 12:00:00', 'Disetujui', '2026-10-06 13:30:00'),
(10, 12, 'Praktikum Algoritma dan Pemrograman', '2026-10-14 08:00:00', '2026-10-14 12:00:00', 'Disetujui', '2026-10-07 15:00:00'),
(11, 13, 'Pelatihan Microsoft Office', '2026-10-18 09:00:00', '2026-10-18 13:00:00', 'Disetujui', '2026-10-08 12:30:00'),
(12, 3, 'Praktikum Elektronika', '2026-10-20 09:00:00', '2026-10-20 12:00:00', 'Disetujui', '2026-10-09 09:00:00'),
(13, 4, 'Workshop Web Development', '2026-10-25 08:00:00', '2026-10-25 11:00:00', 'Disetujui', '2026-10-11 09:15:00'),
(14, 5, 'Praktikum Kecerdasan Buatan', '2026-10-23 10:00:00', '2026-10-23 12:00:00', 'Disetujui', '2026-10-12 12:45:00'),
(15, 6, 'Pelatihan Analisis Data', '2026-10-17 10:00:00', '2026-10-17 14:00:00', 'Disetujui', '2026-10-13 13:30:00'),
(16, 7, 'Praktikum Pemrograman Web', '2026-10-23 09:00:00', '2026-10-23 11:00:00', 'Disetujui', '2026-10-14 09:15:00'),
(17, 8, 'Simulasi Ujian Berbasis Komputer', '2026-10-21 14:00:00', '2026-10-21 16:00:00', 'Disetujui', '2026-10-16 15:45:00'),
(18, 9, 'Rapat Koordinasi Laboratorium', '2026-10-21 08:00:00', '2026-10-21 11:00:00', 'Disetujui', '2026-10-17 13:00:00'),
(19, 10, 'Pelatihan Keamanan Siber', '2026-10-20 09:00:00', '2026-10-20 13:00:00', 'Disetujui', '2026-10-18 14:30:00'),
(20, 11, 'Praktikum Arsitektur Komputer', '2026-10-30 13:00:00', '2026-10-30 16:00:00', 'Disetujui', '2026-10-19 13:15:00'),
(21, 12, 'Praktikum Pemrograman Dasar - Sesi 2', '2026-10-25 09:00:00', '2026-10-25 11:00:00', 'Disetujui', '2026-10-20 15:15:00'),
(22, 13, 'Praktikum Basis Data - Sesi 2', '2026-11-01 13:00:00', '2026-11-01 16:00:00', 'Disetujui', '2026-10-22 12:45:00'),
(23, 3, 'Praktikum Jaringan Komputer - Sesi 2', '2026-11-01 13:00:00', '2026-11-01 15:00:00', 'Disetujui', '2026-10-23 11:15:00'),
(24, 4, 'Praktikum Sistem Operasi - Sesi 2', '2026-10-27 09:00:00', '2026-10-27 13:00:00', 'Disetujui', '2026-10-24 08:00:00'),
(25, 5, 'Praktikum Multimedia - Sesi 2', '2026-11-01 13:00:00', '2026-11-01 17:00:00', 'Disetujui', '2026-10-25 14:00:00'),
(26, 6, 'Pelatihan Desain Grafis - Sesi 2', '2026-11-05 08:00:00', '2026-11-05 12:00:00', 'Disetujui', '2026-10-27 15:30:00'),
(27, 7, 'Workshop Internet of Things - Sesi 2', '2026-11-10 10:00:00', '2026-11-10 12:00:00', 'Disetujui', '2026-10-28 09:30:00'),
(28, 8, 'Seminar Teknologi Informasi - Sesi 2', '2026-11-01 13:00:00', '2026-11-01 15:00:00', 'Disetujui', '2026-10-29 12:45:00'),
(29, 9, 'Uji Kompetensi Komputer - Sesi 2', '2026-11-08 08:00:00', '2026-11-08 12:00:00', 'Disetujui', '2026-10-30 12:15:00'),
(30, 10, 'Praktikum Algoritma dan Pemrograman - Sesi 2', '2026-11-04 10:00:00', '2026-11-04 12:00:00', 'Disetujui', '2026-11-01 12:15:00'),
(31, 11, 'Pelatihan Microsoft Office - Sesi 2', '2026-11-10 08:00:00', '2026-11-10 10:00:00', 'Disetujui', '2026-11-02 08:30:00'),
(32, 12, 'Praktikum Elektronika - Sesi 2', '2026-11-07 08:00:00', '2026-11-07 10:00:00', 'Disetujui', '2026-11-03 13:30:00'),
(33, 13, 'Workshop Web Development - Sesi 2', '2026-11-16 13:00:00', '2026-11-16 15:00:00', 'Disetujui', '2026-11-04 09:00:00'),
(34, 3, 'Praktikum Kecerdasan Buatan - Sesi 2', '2026-11-16 13:00:00', '2026-11-16 17:00:00', 'Disetujui', '2026-11-05 10:15:00'),
(35, 4, 'Pelatihan Analisis Data - Sesi 2', '2026-11-16 14:00:00', '2026-11-16 17:00:00', 'Disetujui', '2026-11-07 10:30:00'),
(36, 5, 'Praktikum Pemrograman Web - Sesi 2', '2026-11-20 10:00:00', '2026-11-20 13:00:00', 'Ditolak', '2026-11-08 11:15:00'),
(37, 6, 'Simulasi Ujian Berbasis Komputer - Sesi 2', '2026-11-18 13:00:00', '2026-11-18 15:00:00', 'Ditolak', '2026-11-09 13:45:00'),
(38, 7, 'Rapat Koordinasi Laboratorium - Sesi 2', '2026-11-12 10:00:00', '2026-11-12 12:00:00', 'Ditolak', '2026-11-10 11:15:00'),
(39, 8, 'Pelatihan Keamanan Siber - Sesi 2', '2026-11-13 08:00:00', '2026-11-13 12:00:00', 'Ditolak', '2026-11-12 11:15:00'),
(40, 9, 'Praktikum Arsitektur Komputer - Sesi 2', '2026-11-15 08:00:00', '2026-11-15 11:00:00', 'Ditolak', '2026-11-13 08:15:00'),
(41, 10, 'Praktikum Pemrograman Dasar - Sesi 3', '2026-11-19 13:00:00', '2026-11-19 15:00:00', 'Ditolak', '2026-11-14 09:15:00'),
(42, 11, 'Praktikum Basis Data - Sesi 3', '2026-11-19 13:00:00', '2026-11-19 16:00:00', 'Ditolak', '2026-11-15 10:45:00'),
(43, 12, 'Praktikum Jaringan Komputer - Sesi 3', '2026-11-18 13:00:00', '2026-11-18 16:00:00', 'Ditolak', '2026-11-16 11:00:00'),
(44, 13, 'Praktikum Sistem Operasi - Sesi 3', '2026-11-26 08:00:00', '2026-11-26 12:00:00', 'Ditolak', '2026-11-18 14:45:00'),
(45, 3, 'Praktikum Multimedia - Sesi 3', '2026-11-26 10:00:00', '2026-11-26 12:00:00', 'Ditolak', '2026-11-19 09:00:00'),
(46, 4, 'Pelatihan Desain Grafis - Sesi 3', '2026-11-24 14:00:00', '2026-11-24 17:00:00', 'ditolak', '2026-11-20 11:15:00'),
(47, 5, 'Workshop Internet of Things - Sesi 3', '2026-11-24 10:00:00', '2026-11-24 13:00:00', 'ditolak', '2026-11-21 10:45:00'),
(48, 6, 'Seminar Teknologi Informasi - Sesi 3', '2026-12-01 14:00:00', '2026-12-01 16:00:00', 'Menunggu', '2026-11-23 11:00:00'),
(49, 7, 'Uji Kompetensi Komputer - Sesi 3', '2026-11-26 09:00:00', '2026-11-26 11:00:00', 'ditolak', '2026-11-24 08:00:00'),
(50, 8, 'Praktikum Algoritma dan Pemrograman - Sesi 3', '2026-12-03 09:00:00', '2026-12-03 12:00:00', 'Menunggu', '2026-11-25 14:45:00'),
(51, 9, 'Rapat Asisten untuk bahas seminar praktikum pemrograman terstruktur', '2026-11-27 08:11:00', '2026-11-27 10:08:00', 'disetujui', '2026-11-27 08:10:12');

-- --------------------------------------------------------

--
-- Table structure for table `pengajuan_aturan`
--

CREATE TABLE `pengajuan_aturan` (
  `id_pengajuan_aturan` bigint(20) UNSIGNED NOT NULL,
  `id_pengajuan` bigint(20) UNSIGNED NOT NULL,
  `id_aturan_kriteria` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pengajuan_aturan`
--

INSERT INTO `pengajuan_aturan` (`id_pengajuan_aturan`, `id_pengajuan`, `id_aturan_kriteria`) VALUES
(1, 51, 8);

-- --------------------------------------------------------

--
-- Table structure for table `pengajuan_fasilitas`
--

CREATE TABLE `pengajuan_fasilitas` (
  `id_pengajuan_fasilitas` bigint(20) UNSIGNED NOT NULL,
  `id_pengajuan` bigint(20) UNSIGNED NOT NULL,
  `id_fasilitas` bigint(20) UNSIGNED NOT NULL,
  `jumlah` int(11) NOT NULL
) ;

--
-- Dumping data for table `pengajuan_fasilitas`
--

INSERT INTO `pengajuan_fasilitas` (`id_pengajuan_fasilitas`, `id_pengajuan`, `id_fasilitas`, `jumlah`) VALUES
(98, 1, 4, 1),
(99, 2, 2, 1),
(100, 2, 4, 1),
(101, 3, 6, 2),
(102, 3, 4, 1),
(103, 4, 6, 2),
(104, 4, 2, 1),
(105, 5, 5, 2),
(106, 6, 2, 1),
(107, 7, 2, 1),
(108, 7, 5, 2),
(109, 7, 4, 1),
(110, 8, 2, 1),
(111, 9, 6, 2),
(112, 9, 5, 2),
(113, 9, 2, 1),
(114, 10, 2, 1),
(115, 11, 2, 1),
(116, 12, 2, 1),
(117, 12, 5, 2),
(118, 12, 6, 2),
(119, 13, 2, 1),
(120, 13, 5, 2),
(121, 14, 2, 1),
(122, 15, 2, 1),
(123, 15, 4, 1),
(124, 15, 5, 2),
(125, 16, 4, 1),
(126, 16, 5, 2),
(127, 17, 5, 2),
(128, 17, 2, 1),
(129, 17, 4, 1),
(130, 18, 4, 1),
(131, 18, 5, 2),
(132, 19, 5, 2),
(133, 19, 4, 1),
(134, 19, 6, 2),
(135, 20, 2, 1),
(136, 21, 2, 1),
(137, 21, 6, 2),
(138, 22, 4, 1),
(139, 22, 5, 2),
(140, 22, 6, 2),
(141, 23, 5, 2),
(142, 24, 4, 1),
(143, 25, 5, 2),
(144, 25, 2, 1),
(145, 26, 5, 2),
(146, 26, 6, 2),
(147, 27, 2, 1),
(148, 27, 5, 2),
(149, 27, 4, 1),
(150, 28, 2, 1),
(151, 28, 6, 2),
(152, 28, 4, 1),
(153, 29, 2, 1),
(154, 30, 4, 1),
(155, 30, 6, 2),
(156, 30, 5, 2),
(157, 31, 4, 1),
(158, 31, 5, 2),
(159, 31, 6, 2),
(160, 32, 5, 2),
(161, 33, 6, 2),
(162, 33, 4, 1),
(163, 33, 2, 1),
(164, 34, 6, 2),
(165, 35, 2, 1),
(166, 35, 6, 2),
(167, 36, 4, 1),
(168, 36, 5, 2),
(169, 37, 4, 1),
(170, 37, 5, 2),
(171, 38, 6, 2),
(172, 38, 5, 2),
(173, 39, 2, 1),
(174, 40, 4, 1),
(175, 41, 2, 1),
(176, 41, 4, 1),
(177, 41, 6, 2),
(178, 42, 4, 1),
(179, 42, 2, 1),
(180, 43, 5, 2),
(181, 43, 2, 1),
(182, 44, 4, 1),
(183, 44, 5, 2),
(184, 45, 2, 1),
(185, 46, 6, 2),
(186, 46, 5, 2),
(187, 47, 4, 1),
(188, 47, 2, 1),
(189, 47, 5, 2),
(190, 48, 6, 2),
(191, 49, 4, 1),
(192, 50, 5, 2),
(193, 50, 4, 1),
(194, 50, 2, 1),
(195, 51, 2, 1),
(196, 51, 4, 5),
(197, 51, 5, 5),
(198, 51, 6, 5);

-- --------------------------------------------------------

--
-- Table structure for table `pengajuan_konflik`
--

CREATE TABLE `pengajuan_konflik` (
  `id_pengajuan_konflik` bigint(20) UNSIGNED NOT NULL,
  `id_konflik` bigint(20) UNSIGNED NOT NULL,
  `id_pengajuan` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rekomendasi`
--

CREATE TABLE `rekomendasi` (
  `id_rekomendasi` bigint(20) UNSIGNED NOT NULL,
  `id_pengajuan` bigint(20) UNSIGNED NOT NULL,
  `id_user_laboran` bigint(20) UNSIGNED NOT NULL,
  `catatan` text DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'Menunggu',
  `waktu_dibuat` datetime NOT NULL DEFAULT current_timestamp(),
  `waktu_dikirim` datetime DEFAULT NULL,
  `batas_waktu` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `rekomendasi`
--

INSERT INTO `rekomendasi` (`id_rekomendasi`, `id_pengajuan`, `id_user_laboran`, `catatan`, `status`, `waktu_dibuat`, `waktu_dikirim`, `batas_waktu`) VALUES
(1, 1, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-09-26 09:00:00', '2026-09-26 14:00:00', '2026-09-28 09:00:00'),
(2, 2, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-09-27 11:15:00', '2026-09-27 14:15:00', '2026-09-29 11:15:00'),
(3, 3, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-09-28 09:45:00', '2026-09-28 11:45:00', '2026-09-30 09:45:00'),
(4, 4, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-09-30 11:15:00', '2026-09-30 18:15:00', '2026-10-02 11:15:00'),
(5, 5, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-01 11:45:00', '2026-10-01 12:45:00', '2026-10-03 11:45:00'),
(6, 6, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-02 12:00:00', '2026-10-02 20:00:00', '2026-10-04 12:00:00'),
(7, 7, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-03 14:30:00', '2026-10-03 18:30:00', '2026-10-05 14:30:00'),
(8, 8, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-05 13:00:00', '2026-10-05 17:00:00', '2026-10-07 13:00:00'),
(9, 9, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-06 13:30:00', '2026-10-06 21:30:00', '2026-10-08 13:30:00'),
(10, 10, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-07 15:00:00', '2026-10-07 21:00:00', '2026-10-09 15:00:00'),
(11, 11, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-08 12:30:00', '2026-10-08 17:30:00', '2026-10-10 12:30:00'),
(12, 12, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-09 09:00:00', '2026-10-09 13:00:00', '2026-10-11 09:00:00'),
(13, 13, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-11 09:15:00', '2026-10-11 13:15:00', '2026-10-13 09:15:00'),
(14, 14, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-12 12:45:00', '2026-10-12 13:45:00', '2026-10-14 12:45:00'),
(15, 15, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-13 13:30:00', '2026-10-13 17:30:00', '2026-10-15 13:30:00'),
(16, 16, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-14 09:15:00', '2026-10-14 16:15:00', '2026-10-16 09:15:00'),
(17, 17, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-16 15:45:00', '2026-10-16 21:45:00', '2026-10-18 15:45:00'),
(18, 18, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-17 13:00:00', '2026-10-17 18:00:00', '2026-10-19 13:00:00'),
(19, 19, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-18 14:30:00', '2026-10-18 16:30:00', '2026-10-20 14:30:00'),
(20, 20, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-19 13:15:00', '2026-10-19 18:15:00', '2026-10-21 13:15:00'),
(21, 21, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-20 15:15:00', '2026-10-20 21:15:00', '2026-10-22 15:15:00'),
(22, 22, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-22 12:45:00', '2026-10-22 19:45:00', '2026-10-24 12:45:00'),
(23, 23, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-23 11:15:00', '2026-10-23 17:15:00', '2026-10-25 11:15:00'),
(24, 24, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-24 08:00:00', '2026-10-24 09:00:00', '2026-10-26 08:00:00'),
(25, 25, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-25 14:00:00', '2026-10-25 16:00:00', '2026-10-27 14:00:00'),
(26, 26, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-27 15:30:00', '2026-10-27 20:30:00', '2026-10-29 15:30:00'),
(27, 27, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-28 09:30:00', '2026-10-28 12:30:00', '2026-10-30 09:30:00'),
(28, 28, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-29 12:45:00', '2026-10-29 17:45:00', '2026-10-31 12:45:00'),
(29, 29, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-10-30 12:15:00', '2026-10-30 13:15:00', '2026-11-01 12:15:00'),
(30, 30, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-11-01 12:15:00', '2026-11-01 14:15:00', '2026-11-03 12:15:00'),
(31, 31, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-11-02 08:30:00', '2026-11-02 15:30:00', '2026-11-04 08:30:00'),
(32, 32, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-11-03 13:30:00', '2026-11-03 19:30:00', '2026-11-05 13:30:00'),
(33, 33, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-11-04 09:00:00', '2026-11-04 15:00:00', '2026-11-06 09:00:00'),
(34, 34, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-11-05 10:15:00', '2026-11-05 17:15:00', '2026-11-07 10:15:00'),
(35, 35, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Disetujui', '2026-11-07 10:30:00', '2026-11-07 12:30:00', '2026-11-09 10:30:00'),
(36, 36, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Ditolak', '2026-11-08 11:15:00', '2026-11-08 18:15:00', '2026-11-10 11:15:00'),
(37, 37, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Ditolak', '2026-11-09 13:45:00', '2026-11-09 17:45:00', '2026-11-11 13:45:00'),
(38, 38, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Ditolak', '2026-11-10 11:15:00', '2026-11-10 16:15:00', '2026-11-12 11:15:00'),
(39, 39, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Ditolak', '2026-11-12 11:15:00', '2026-11-12 12:15:00', '2026-11-14 11:15:00'),
(40, 40, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Ditolak', '2026-11-13 08:15:00', '2026-11-13 15:15:00', '2026-11-15 08:15:00'),
(41, 41, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Ditolak', '2026-11-14 09:15:00', '2026-11-14 10:15:00', '2026-11-16 09:15:00'),
(42, 42, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Ditolak', '2026-11-15 10:45:00', '2026-11-15 14:45:00', '2026-11-17 10:45:00'),
(43, 43, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Ditolak', '2026-11-16 11:00:00', '2026-11-16 17:00:00', '2026-11-18 11:00:00'),
(44, 44, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Ditolak', '2026-11-18 14:45:00', '2026-11-18 21:45:00', '2026-11-20 14:45:00'),
(45, 45, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Ditolak', '2026-11-19 09:00:00', '2026-11-19 11:00:00', '2026-11-21 09:00:00'),
(46, 46, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Menunggu', '2026-11-20 11:15:00', NULL, '2026-11-22 11:15:00'),
(47, 47, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Menunggu', '2026-11-21 10:45:00', NULL, '2026-11-23 10:45:00'),
(48, 48, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Menunggu', '2026-11-23 11:00:00', NULL, '2026-11-25 11:00:00'),
(49, 49, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Menunggu', '2026-11-24 08:00:00', NULL, '2026-11-26 08:00:00'),
(50, 50, 2, 'Data historis/dummy untuk kebutuhan pengujian laporan.', 'Menunggu', '2026-11-25 14:45:00', NULL, '2026-11-27 14:45:00');

-- --------------------------------------------------------

--
-- Table structure for table `skor_pengajuan`
--

CREATE TABLE `skor_pengajuan` (
  `id_score_pengajuan` bigint(20) UNSIGNED NOT NULL,
  `id_pengajuan` bigint(20) UNSIGNED NOT NULL,
  `skor_jenis_kegiatan` decimal(5,2) NOT NULL DEFAULT 0.00,
  `skor_fasilitas` decimal(5,2) NOT NULL DEFAULT 0.00,
  `skor_akhir` decimal(5,2) NOT NULL DEFAULT 0.00,
  `prioritas` int(11) DEFAULT NULL,
  `waktu_perhitungan_dilakukan` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `skor_pengajuan`
--

INSERT INTO `skor_pengajuan` (`id_score_pengajuan`, `id_pengajuan`, `skor_jenis_kegiatan`, `skor_fasilitas`, `skor_akhir`, `prioritas`, `waktu_perhitungan_dilakukan`) VALUES
(1, 1, 97.70, 96.04, 96.87, 1, '2026-09-26 09:10:00'),
(2, 2, 83.04, 83.17, 83.11, 2, '2026-09-27 11:25:00'),
(3, 3, 60.61, 95.00, 77.81, 3, '2026-09-28 09:55:00'),
(4, 4, 77.82, 83.34, 80.58, 4, '2026-09-30 11:25:00'),
(5, 5, 69.68, 84.86, 77.27, 1, '2026-10-01 11:55:00'),
(6, 6, 79.95, 59.59, 69.77, 2, '2026-10-02 12:10:00'),
(7, 7, 84.92, 68.96, 76.94, 3, '2026-10-03 14:40:00'),
(8, 8, 88.67, 58.70, 73.69, 4, '2026-10-05 13:10:00'),
(9, 9, 80.61, 70.30, 75.45, 1, '2026-10-06 13:40:00'),
(10, 10, 92.52, 65.19, 78.85, 2, '2026-10-07 15:10:00'),
(11, 11, 64.46, 89.29, 76.88, 3, '2026-10-08 12:40:00'),
(12, 12, 82.30, 66.11, 74.20, 4, '2026-10-09 09:10:00'),
(13, 13, 74.88, 83.78, 79.33, 1, '2026-10-11 09:25:00'),
(14, 14, 78.00, 89.69, 83.84, 2, '2026-10-12 12:55:00'),
(15, 15, 98.19, 86.80, 92.50, 3, '2026-10-13 13:40:00'),
(16, 16, 84.65, 64.19, 74.42, 4, '2026-10-14 09:25:00'),
(17, 17, 84.87, 80.96, 82.91, 1, '2026-10-16 15:55:00'),
(18, 18, 59.20, 97.60, 78.40, 2, '2026-10-17 13:10:00'),
(19, 19, 65.57, 65.52, 65.54, 3, '2026-10-18 14:40:00'),
(20, 20, 91.30, 57.37, 74.33, 4, '2026-10-19 13:25:00'),
(21, 21, 57.08, 99.20, 78.14, 1, '2026-10-20 15:25:00'),
(22, 22, 82.51, 88.42, 85.47, 2, '2026-10-22 12:55:00'),
(23, 23, 75.49, 94.31, 84.90, 3, '2026-10-23 11:25:00'),
(24, 24, 80.91, 85.92, 83.41, 4, '2026-10-24 08:10:00'),
(25, 25, 72.28, 69.98, 71.13, 1, '2026-10-25 14:10:00'),
(26, 26, 61.64, 84.38, 73.01, 2, '2026-10-27 15:40:00'),
(27, 27, 95.17, 93.02, 94.09, 3, '2026-10-28 09:40:00'),
(28, 28, 94.85, 88.92, 91.88, 4, '2026-10-29 12:55:00'),
(29, 29, 64.85, 90.21, 77.53, 1, '2026-10-30 12:25:00'),
(30, 30, 86.32, 73.23, 79.78, 2, '2026-11-01 12:25:00'),
(31, 31, 80.08, 95.87, 87.97, 3, '2026-11-02 08:40:00'),
(32, 32, 60.46, 56.67, 58.56, 4, '2026-11-03 13:40:00'),
(33, 33, 75.91, 76.56, 76.23, 1, '2026-11-04 09:10:00'),
(34, 34, 80.15, 65.86, 73.00, 2, '2026-11-05 10:25:00'),
(35, 35, 88.99, 72.13, 80.56, 3, '2026-11-07 10:40:00'),
(36, 36, 91.68, 94.60, 93.14, 4, '2026-11-08 11:25:00'),
(37, 37, 74.20, 95.34, 84.77, 1, '2026-11-09 13:55:00'),
(38, 38, 75.07, 57.96, 66.52, 2, '2026-11-10 11:25:00'),
(39, 39, 93.77, 72.50, 83.13, 3, '2026-11-12 11:25:00'),
(40, 40, 88.83, 91.99, 90.41, 4, '2026-11-13 08:25:00'),
(41, 41, 67.48, 88.88, 78.18, 1, '2026-11-14 09:25:00'),
(42, 42, 76.81, 61.96, 69.39, 2, '2026-11-15 10:55:00'),
(43, 43, 74.79, 85.68, 80.24, 3, '2026-11-16 11:10:00'),
(44, 44, 65.55, 66.79, 66.17, 4, '2026-11-18 14:55:00'),
(45, 45, 95.19, 54.03, 74.61, 1, '2026-11-19 09:10:00'),
(46, 46, 61.79, 69.15, 65.47, 2, '2026-11-20 11:25:00'),
(47, 47, 61.88, 60.70, 61.29, 3, '2026-11-21 10:55:00'),
(48, 48, 73.67, 66.54, 70.11, 4, '2026-11-23 11:10:00'),
(49, 49, 75.97, 53.11, 64.54, 1, '2026-11-24 08:10:00'),
(50, 50, 92.48, 69.47, 80.97, 2, '2026-11-25 14:55:00'),
(51, 51, 15.00, 5.84, 20.84, 4, '2026-11-27 08:10:12');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id_user` bigint(20) UNSIGNED NOT NULL,
  `role` varchar(30) NOT NULL,
  `nip_npm` varchar(30) NOT NULL,
  `nama` varchar(100) NOT NULL,
  `no_telepon` varchar(20) NOT NULL,
  `password` varchar(100) NOT NULL,
  `status` varchar(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id_user`, `role`, `nip_npm`, `nama`, `no_telepon`, `password`, `status`) VALUES
(1, 'kepala_lab', '001', 'Kepala Laboratorium', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(2, 'laboran', '002', 'Laboran SILAB', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(3, 'pengguna', '07352411037', 'Desy Indriasty', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(4, 'pengguna', '07352411039', 'Felisha', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(5, 'pengguna', '07352411042', 'Laudya', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(6, 'pengguna', '07352411038', 'Djuleha M. Asyik', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(7, 'pengguna', '07352511099', 'Reynaldi', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(8, 'pengguna', '07352511058', 'Balqis', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(9, 'pengguna', '07352411005', 'Widya', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(10, 'pengguna', '0735241104', 'Bintoro', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(11, 'pengguna', '07352411002', 'Arini', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(12, 'pengguna', '07352411011', 'Syifa', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif'),
(13, 'pengguna', '07352411012', 'Lisya', '', '$2y$12$9THIu8abnLTxubAf.toK/ulgdXvTnobQumqYBXJoxPapScdIvjD8y', 'aktif');

-- --------------------------------------------------------

--
-- Table structure for table `validasi_booking`
--

CREATE TABLE `validasi_booking` (
  `id_validasi_booking` bigint(20) UNSIGNED NOT NULL,
  `id_booking` bigint(20) UNSIGNED NOT NULL,
  `id_user_laboran` bigint(20) UNSIGNED NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'Menunggu',
  `waktu_validasi` datetime DEFAULT NULL,
  `waktu_dibuat` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `validasi_booking`
--

INSERT INTO `validasi_booking` (`id_validasi_booking`, `id_booking`, `id_user_laboran`, `status`, `waktu_validasi`, `waktu_dibuat`) VALUES
(1, 1, 2, 'Disetujui', '2026-09-26 11:00:00', '2026-09-26 11:00:00'),
(2, 2, 2, 'Disetujui', '2026-09-27 13:15:00', '2026-09-27 13:15:00'),
(3, 3, 2, 'Disetujui', '2026-09-28 11:45:00', '2026-09-28 11:45:00'),
(4, 4, 2, 'Disetujui', '2026-09-30 13:15:00', '2026-09-30 13:15:00'),
(5, 5, 2, 'Disetujui', '2026-10-01 13:45:00', '2026-10-01 13:45:00'),
(6, 6, 2, 'Disetujui', '2026-10-02 14:00:00', '2026-10-02 14:00:00'),
(7, 7, 2, 'Disetujui', '2026-10-03 16:30:00', '2026-10-03 16:30:00'),
(8, 8, 2, 'Disetujui', '2026-10-05 15:00:00', '2026-10-05 15:00:00'),
(9, 9, 2, 'Disetujui', '2026-10-06 15:30:00', '2026-10-06 15:30:00'),
(10, 10, 2, 'Disetujui', '2026-10-07 17:00:00', '2026-10-07 17:00:00'),
(11, 11, 2, 'Disetujui', '2026-10-08 14:30:00', '2026-10-08 14:30:00'),
(12, 12, 2, 'Disetujui', '2026-10-09 11:00:00', '2026-10-09 11:00:00'),
(13, 13, 2, 'Disetujui', '2026-10-11 11:15:00', '2026-10-11 11:15:00'),
(14, 14, 2, 'Disetujui', '2026-10-12 14:45:00', '2026-10-12 14:45:00'),
(15, 15, 2, 'Disetujui', '2026-10-13 15:30:00', '2026-10-13 15:30:00'),
(16, 16, 2, 'Disetujui', '2026-10-14 11:15:00', '2026-10-14 11:15:00'),
(17, 17, 2, 'Disetujui', '2026-10-16 17:45:00', '2026-10-16 17:45:00'),
(18, 18, 2, 'Disetujui', '2026-10-17 15:00:00', '2026-10-17 15:00:00'),
(19, 19, 2, 'Disetujui', '2026-10-18 16:30:00', '2026-10-18 16:30:00'),
(20, 20, 2, 'Disetujui', '2026-10-19 15:15:00', '2026-10-19 15:15:00'),
(21, 21, 2, 'Disetujui', '2026-10-20 17:15:00', '2026-10-20 17:15:00'),
(22, 22, 2, 'Disetujui', '2026-10-22 14:45:00', '2026-10-22 14:45:00'),
(23, 23, 2, 'Disetujui', '2026-10-23 13:15:00', '2026-10-23 13:15:00'),
(24, 24, 2, 'Disetujui', '2026-10-24 10:00:00', '2026-10-24 10:00:00'),
(25, 25, 2, 'Disetujui', '2026-10-25 16:00:00', '2026-10-25 16:00:00'),
(26, 26, 2, 'Disetujui', '2026-10-27 17:30:00', '2026-10-27 17:30:00'),
(27, 27, 2, 'Disetujui', '2026-10-28 11:30:00', '2026-10-28 11:30:00'),
(28, 28, 2, 'Disetujui', '2026-10-29 14:45:00', '2026-10-29 14:45:00'),
(29, 29, 2, 'Disetujui', '2026-10-30 14:15:00', '2026-10-30 14:15:00'),
(30, 30, 2, 'Disetujui', '2026-11-01 14:15:00', '2026-11-01 14:15:00'),
(31, 31, 2, 'Disetujui', '2026-11-02 10:30:00', '2026-11-02 10:30:00'),
(32, 32, 2, 'Disetujui', '2026-11-03 15:30:00', '2026-11-03 15:30:00'),
(33, 33, 2, 'Disetujui', '2026-11-04 11:00:00', '2026-11-04 11:00:00'),
(34, 34, 2, 'Disetujui', '2026-11-05 12:15:00', '2026-11-05 12:15:00'),
(35, 35, 2, 'Disetujui', '2026-11-07 12:30:00', '2026-11-07 12:30:00'),
(36, 36, 2, 'digunakan', '2026-11-27 08:11:16', '2026-11-27 08:11:07');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `alternatif_rekomendasi`
--
ALTER TABLE `alternatif_rekomendasi`
  ADD PRIMARY KEY (`id_alternatif_rekomendasi`),
  ADD KEY `idx_alternatif_rekomendasi` (`id_rekomendasi`);

--
-- Indexes for table `aturan`
--
ALTER TABLE `aturan`
  ADD PRIMARY KEY (`id_aturan`);

--
-- Indexes for table `aturan_kriteria`
--
ALTER TABLE `aturan_kriteria`
  ADD PRIMARY KEY (`id_aturan_kriteria`),
  ADD KEY `idx_id_aturan` (`id_aturan`);

--
-- Indexes for table `booking`
--
ALTER TABLE `booking`
  ADD PRIMARY KEY (`id_booking`),
  ADD UNIQUE KEY `uq_booking_pengajuan` (`id_pengajuan`);

--
-- Indexes for table `fasilitas`
--
ALTER TABLE `fasilitas`
  ADD PRIMARY KEY (`id_fasilitas`),
  ADD UNIQUE KEY `unique_nama_fasilitas` (`nama_fasilitas`);

--
-- Indexes for table `konflik`
--
ALTER TABLE `konflik`
  ADD PRIMARY KEY (`id_konflik`),
  ADD KEY `idx_konflik_laboran` (`id_user_laboran`),
  ADD KEY `idx_konflik_pengajuan` (`id_pengajuan_terpilih`),
  ADD KEY `idx_konflik_kepala_lab` (`id_user_kepala_lab`);

--
-- Indexes for table `pengajuan`
--
ALTER TABLE `pengajuan`
  ADD PRIMARY KEY (`id_pengajuan`),
  ADD KEY `idx_pengajuan_user` (`id_user`);

--
-- Indexes for table `pengajuan_aturan`
--
ALTER TABLE `pengajuan_aturan`
  ADD PRIMARY KEY (`id_pengajuan_aturan`),
  ADD UNIQUE KEY `uk_pengajuan_kriteria` (`id_pengajuan`,`id_aturan_kriteria`),
  ADD KEY `fk_pa_kriteria` (`id_aturan_kriteria`);

--
-- Indexes for table `pengajuan_fasilitas`
--
ALTER TABLE `pengajuan_fasilitas`
  ADD PRIMARY KEY (`id_pengajuan_fasilitas`),
  ADD UNIQUE KEY `uq_pengajuan_fasilitas` (`id_pengajuan`,`id_fasilitas`),
  ADD KEY `fk_pf_fasilitas` (`id_fasilitas`);

--
-- Indexes for table `pengajuan_konflik`
--
ALTER TABLE `pengajuan_konflik`
  ADD PRIMARY KEY (`id_pengajuan_konflik`),
  ADD UNIQUE KEY `uk_konflik_pengajuan` (`id_konflik`,`id_pengajuan`),
  ADD KEY `idx_pk_pengajuan` (`id_pengajuan`);

--
-- Indexes for table `rekomendasi`
--
ALTER TABLE `rekomendasi`
  ADD PRIMARY KEY (`id_rekomendasi`),
  ADD KEY `idx_rekomendasi_pengajuan` (`id_pengajuan`),
  ADD KEY `idx_rekomendasi_laboran` (`id_user_laboran`);

--
-- Indexes for table `skor_pengajuan`
--
ALTER TABLE `skor_pengajuan`
  ADD PRIMARY KEY (`id_score_pengajuan`),
  ADD UNIQUE KEY `uq_score_pengajuan` (`id_pengajuan`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id_user`),
  ADD UNIQUE KEY `nip_npm` (`nip_npm`);

--
-- Indexes for table `validasi_booking`
--
ALTER TABLE `validasi_booking`
  ADD PRIMARY KEY (`id_validasi_booking`),
  ADD UNIQUE KEY `uq_validasi_booking` (`id_booking`),
  ADD KEY `fk_validasi_laboran` (`id_user_laboran`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `alternatif_rekomendasi`
--
ALTER TABLE `alternatif_rekomendasi`
  MODIFY `id_alternatif_rekomendasi` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `aturan`
--
ALTER TABLE `aturan`
  MODIFY `id_aturan` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `aturan_kriteria`
--
ALTER TABLE `aturan_kriteria`
  MODIFY `id_aturan_kriteria` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `booking`
--
ALTER TABLE `booking`
  MODIFY `id_booking` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT for table `fasilitas`
--
ALTER TABLE `fasilitas`
  MODIFY `id_fasilitas` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `konflik`
--
ALTER TABLE `konflik`
  MODIFY `id_konflik` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pengajuan`
--
ALTER TABLE `pengajuan`
  MODIFY `id_pengajuan` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=52;

--
-- AUTO_INCREMENT for table `pengajuan_aturan`
--
ALTER TABLE `pengajuan_aturan`
  MODIFY `id_pengajuan_aturan` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `pengajuan_fasilitas`
--
ALTER TABLE `pengajuan_fasilitas`
  MODIFY `id_pengajuan_fasilitas` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pengajuan_konflik`
--
ALTER TABLE `pengajuan_konflik`
  MODIFY `id_pengajuan_konflik` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rekomendasi`
--
ALTER TABLE `rekomendasi`
  MODIFY `id_rekomendasi` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `skor_pengajuan`
--
ALTER TABLE `skor_pengajuan`
  MODIFY `id_score_pengajuan` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id_user` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `validasi_booking`
--
ALTER TABLE `validasi_booking`
  MODIFY `id_validasi_booking` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `alternatif_rekomendasi`
--
ALTER TABLE `alternatif_rekomendasi`
  ADD CONSTRAINT `fk_alternatif_rekomendasi` FOREIGN KEY (`id_rekomendasi`) REFERENCES `rekomendasi` (`id_rekomendasi`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `aturan_kriteria`
--
ALTER TABLE `aturan_kriteria`
  ADD CONSTRAINT `fk_kriteria_aturan` FOREIGN KEY (`id_aturan`) REFERENCES `aturan` (`id_aturan`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `booking`
--
ALTER TABLE `booking`
  ADD CONSTRAINT `fk_booking_pengajuan` FOREIGN KEY (`id_pengajuan`) REFERENCES `pengajuan` (`id_pengajuan`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `konflik`
--
ALTER TABLE `konflik`
  ADD CONSTRAINT `fk_konflik_kepala_lab` FOREIGN KEY (`id_user_kepala_lab`) REFERENCES `users` (`id_user`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_konflik_laboran` FOREIGN KEY (`id_user_laboran`) REFERENCES `users` (`id_user`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_konflik_pengajuan` FOREIGN KEY (`id_pengajuan_terpilih`) REFERENCES `pengajuan` (`id_pengajuan`) ON UPDATE CASCADE;

--
-- Constraints for table `pengajuan`
--
ALTER TABLE `pengajuan`
  ADD CONSTRAINT `fk_pengajuan_user` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`) ON UPDATE CASCADE;

--
-- Constraints for table `pengajuan_aturan`
--
ALTER TABLE `pengajuan_aturan`
  ADD CONSTRAINT `fk_pa_kriteria` FOREIGN KEY (`id_aturan_kriteria`) REFERENCES `aturan_kriteria` (`id_aturan_kriteria`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pa_pengajuan` FOREIGN KEY (`id_pengajuan`) REFERENCES `pengajuan` (`id_pengajuan`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `pengajuan_fasilitas`
--
ALTER TABLE `pengajuan_fasilitas`
  ADD CONSTRAINT `fk_pf_fasilitas` FOREIGN KEY (`id_fasilitas`) REFERENCES `fasilitas` (`id_fasilitas`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pf_pengajuan` FOREIGN KEY (`id_pengajuan`) REFERENCES `pengajuan` (`id_pengajuan`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `pengajuan_konflik`
--
ALTER TABLE `pengajuan_konflik`
  ADD CONSTRAINT `fk_pk_konflik` FOREIGN KEY (`id_konflik`) REFERENCES `konflik` (`id_konflik`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pk_pengajuan` FOREIGN KEY (`id_pengajuan`) REFERENCES `pengajuan` (`id_pengajuan`) ON UPDATE CASCADE;

--
-- Constraints for table `rekomendasi`
--
ALTER TABLE `rekomendasi`
  ADD CONSTRAINT `fk_rekomendasi_laboran` FOREIGN KEY (`id_user_laboran`) REFERENCES `users` (`id_user`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_rekomendasi_pengajuan` FOREIGN KEY (`id_pengajuan`) REFERENCES `pengajuan` (`id_pengajuan`) ON UPDATE CASCADE;

--
-- Constraints for table `skor_pengajuan`
--
ALTER TABLE `skor_pengajuan`
  ADD CONSTRAINT `fk_score_pengajuan` FOREIGN KEY (`id_pengajuan`) REFERENCES `pengajuan` (`id_pengajuan`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `validasi_booking`
--
ALTER TABLE `validasi_booking`
  ADD CONSTRAINT `fk_validasi_booking` FOREIGN KEY (`id_booking`) REFERENCES `booking` (`id_booking`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_validasi_laboran` FOREIGN KEY (`id_user_laboran`) REFERENCES `users` (`id_user`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
