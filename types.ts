
export enum Fase {
  A = 'Fase A',
  B = 'Fase B',
  C = 'Fase C'
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  ANALYSIS = 'ANALISIS',
  GENERATOR = 'GENERATOR',
  DOKUMEN = 'DOKUMEN'
}

export type Kelas = '1' | '2' | '3' | '4' | '5' | '6';
export type Role = 'admin' | 'guru';
export type TeacherType = 'kelas' | 'mapel';

export interface School {
  id: string;
  name: string;
  color: string;
}

export const LIST_SEKOLAH: School[] = [
  { id: 'sdn1', name: 'SD NEGERI 1 BILATO', color: 'blue' },
  { id: 'sdn2', name: 'SD NEGERI 2 BILATO', color: 'indigo' },
  { id: 'sdn3', name: 'SD NEGERI 3 BILATO', color: 'violet' },
  { id: 'sdn4', name: 'SD NEGERI 4 BILATO', color: 'emerald' },
  { id: 'sdn5', name: 'SD NEGERI 5 BILATO', color: 'rose' },
  { id: 'sdn6', name: 'SD NEGERI 6 BILATO', color: 'amber' },
  { id: 'sdn7', name: 'SD NEGERI 7 BILATO', color: 'cyan' },
  { id: 'sdn8', name: 'SD NEGERI 8 BILATO', color: 'slate' },
];

export interface User {
  id: string;
  username: string;
  password?: string;
  role: Role;
  teacherType: TeacherType;
  name: string;
  nip: string;
  kelas: string;
  mapelDiampu: string[];
  apiKey?: string;
  schoolId?: string;
}

export interface Siswa {
  id: string;
  nis: string;
  name: string;
  kelas: Kelas;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  base64: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

export interface AsesmenNilai {
  id: string;
  siswaId: string;
  tpId: string;
  nilai: number;
  catatan?: string;
}

export interface AsesmenInstrumen {
  id: string;
  fase: Fase;
  kelas: Kelas;
  mataPelajaran: string;
  tpId: string;
  tujuanPembelajaran: string;
  rubrik: string;
}

export interface JurnalItem {
  id: string;
  userId: string;
  userName: string;
  tahunPelajaran: string;
  kelas: Kelas;
  tanggal: string;
  mataPelajaran: string;
  materi: string;
  detailKegiatan: string;
  praktikPedagogis: string;
  absenSiswa?: string;
  catatanKejadian?: string;
}

export interface KisiKisiItem {
  id: string;
  fase: Fase;
  kelas: Kelas;
  semester: '1' | '2';
  mataPelajaran: string;
  namaAsesmen: string;
  elemen: string;
  cp: string;
  kompetensi: 'Pengetahuan dan Pemahaman' | 'Aplikasi' | 'Penalaran';
  tpId: string;
  tujuanPembelajaran: string;
  indikatorSoal: string;
  jenis: 'Tes' | 'Non Tes';
  bentukSoal: string;
  stimulus: string;
  soal: string;
  kunciJawaban: string;
  nomorSoal: number;
}

export interface SchoolSettings {
  schoolName: string;
  address: string;
  principalName: string;
  principalNip: string;
}

export interface AcademicYear {
  id: string;
  year: string;
  isActive: boolean;
}

export interface HariEfektif {
  id: string;
  kelas: Kelas;
  semester: 1 | 2;
  bulan: string;
  jumlahMinggu: number;
  mingguTidakEfektif: number;
  keterangan: string;
}

export interface EventKalender {
  id: string;
  date: string;
  title: string;
  type: 'libur' | 'ujian' | 'kegiatan' | 'penting';
  description?: string;
}

export interface JadwalItem {
  id: string;
  hari: string;
  jamKe: number;
  mapel: string;
  kelas: Kelas;
}

export interface CapaianPembelajaran {
  id: string;
  fase: Fase;
  mataPelajaran: string;
  kode: string;
  elemen: string;
  deskripsi: string;
}

export interface AnalisisCP {
  id: string;
  cpId: string;
  fase: Fase;
  kelas: Kelas;
  mataPelajaran: string;
  materi: string;
  subMateri: string;
  tujuanPembelajaran: string;
  indexOrder: number;
}

export interface ATPItem {
  id: string;
  fase: Fase;
  kelas: Kelas;
  mataPelajaran: string;
  elemen: string;
  capaianPembelajaran: string;
  materi: string;
  subMateri: string;
  tujuanPembelajaran: string;
  alurTujuanPembelajaran: string;
  alokasiWaktu: string;
  dimensiProfilLulusan: string;
  asesmenAwal: string;
  asesmenProses: string;
  asesmenAkhir: string;
  sumberBelajar: string;
  indexOrder: number;
}

export interface ProtaItem {
  id: string;
  fase: Fase;
  kelas: Kelas;
  mataPelajaran: string;
  tujuanPembelajaran: string;
  materiPokok: string;
  subMateri: string;
  jp: string;
  semester: '1' | '2';
  indexOrder: number;
}

export interface PromesItem {
  id: string;
  fase: Fase;
  kelas: Kelas;
  semester: '1' | '2';
  mataPelajaran: string;
  materiPokok: string;
  subMateri: string;
  tujuanPembelajaran: string;
  alokasiWaktu: string;
  bulanPelaksanaan: string;
  jadwalMingguan: Record<string, number[]>;
  keterangan: string;
  indexOrder?: number;
}

export interface RPMItem {
  id: string;
  atpId: string;
  fase: Fase;
  kelas: Kelas;
  semester: '1' | '2';
  mataPelajaran: string;
  tujuanPembelajaran: string;
  materi: string;
  subMateri: string;
  alokasiWaktu: string;
  jumlahPertemuan: number;
  asesmenAwal: string;
  dimensiProfil: string[];
  praktikPedagogis: string;
  kemitraan: string;
  environment?: string;
  lingkunganBelajar: string;
  pemanfaatanDigital: string;
  kegiatanAwal: string;
  kegiatanInti: string;
  kegiatanPenutup: string;
  asesmenTeknik: string;
}

export interface LKPDItem {
  id: string;
  rpmId: string;
  fase: Fase;
  kelas: Kelas;
  semester: '1' | '2';
  mataPelajaran: string;
  judul: string;
  tujuanPembelajaran: string;
  petunjuk: string;
  materiRingkas: string;
  langkahKerja: string;
  tugasMandiri: string;
  refleksi: string;
  jumlahPertemuan: number;
}

export const MATA_PELAJARAN = [
  'Pendidikan Agama dan Budi Pekerti',
  'Pendidikan Pancasila',
  'Bahasa Indonesia',
  'Matematika',
  'IPAS',
  'Seni dan Budaya',
  'PJOK',
  'Bahasa Inggris',
  'Koding dan KA',
  'Mulok',
  'Kokurikuler',
  'Istirahat',
  'Upacara/Apel'
];

export const DIMENSI_PROFIL = [
  'Keimanan & Ketakwaan',
  'Kewargaan',
  'Penalaran Kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi'
];