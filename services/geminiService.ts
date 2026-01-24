
import { GoogleGenAI, Type } from "@google/genai";
import { UploadedFile, Kelas } from "../types";

const cleanAndParseJson = (str: any): any => {
  if (str === null || str === undefined) return null;
  if (typeof str !== 'string') return str;
  try {
    let cleaned = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
    if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    const firstOpen = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIndex = -1;
    let lastIndex = -1;
    if (firstOpen !== -1 && (firstBracket === -1 || firstOpen < firstBracket)) {
      startIndex = firstOpen;
      lastIndex = cleaned.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      startIndex = firstBracket;
      lastIndex = cleaned.lastIndexOf(']');
    }
    if (startIndex === -1 || lastIndex === -1 || lastIndex < startIndex) return JSON.parse(cleaned);
    const jsonPart = cleaned.substring(startIndex, lastIndex + 1);
    return JSON.parse(jsonPart);
  } catch (e: any) {
    console.error("JSON Parse Error:", e);
    return str.startsWith('[') ? [] : {};
  }
};

const getAiClient = (_apiKey?: string) => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
};

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const COMPLEX_MODEL = 'gemini-3-pro-preview'; 
const IMAGE_MODEL = 'gemini-2.5-flash-image';

export const startAIChat = async (systemInstruction: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  return ai.chats.create({
    model: DEFAULT_MODEL,
    config: { systemInstruction, temperature: 0.7 },
  });
};

export const analyzeDocuments = async (files: UploadedFile[], prompt: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const fileParts = files.map(file => ({
    inlineData: { data: file.base64.split(',')[1], mimeType: file.type }
  }));
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: { parts: [...fileParts, { text: prompt }] },
    config: { systemInstruction: "Pakar Kurikulum SD Indonesia. Analisis dokumen dengan tajam dan solutif." }
  });
  return response.text || "AI tidak merespon.";
};

export const analyzeCPToTP = async (cpContent: string, elemen: string, fase: string, kelas: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const prompt = `Analisis Capaian Pembelajaran (CP) untuk Kelas ${kelas} SD. 
  CP: "${cpContent}" 
  Elemen: "${elemen}"
  
  TUGAS UTAMA:
  1. Pecah CP tersebut menjadi beberapa Tujuan Pembelajaran (TP) yang SANGAT RINCI dan TERUKUR.
  2. RUMUSAN TP WAJIB mengandung 2 aspek fundamental: 
     a. KOMPETENSI: Kata kerja operasional (C1-C6) yang dapat diobservasi dan diukur.
     b. LINGKUP MATERI: Konten atau konsep utama yang dipelajari.
  3. Tentukan Materi Pokok dan Sub Materi yang relevan for setiap TP.
  4. Lakukan analisis karakter: Pilih 1-3 'Dimensi Profil Lulusan' (DPL) yang paling relevan.`;

  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            materi: { type: Type.STRING },
            subMateri: { type: Type.STRING },
            tp: { type: Type.STRING },
            profilLulusan: { type: Type.STRING }
          },
          required: ['materi', 'subMateri', 'tp', 'profilLulusan']
        }
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const completeATPDetails = async (tp: string, materi: string, kelas: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const prompt = `Lengkapi rincian Alur Tujuan Pembelajaran (ATP) SD Kelas ${kelas}.
  Tujuan Pembelajaran (TP): "${tp}"
  Materi Utama: "${materi}"`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          alurTujuan: { type: Type.STRING },
          alokasiWaktu: { type: Type.STRING },
          dimensiOfProfil: { type: Type.STRING },
          asesmenAwal: { type: Type.STRING },
          asesmenProses: { type: Type.STRING },
          asesmenAkhir: { type: Type.STRING },
          sumberBelajar: { type: Type.STRING }
        }
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const recommendPedagogy = async (tp: string, alurAtp: string, materi: string, kelas: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { modelName: { type: Type.STRING }, reason: { type: Type.STRING } }
      }
    },
    contents: `Rekomendasi model pembelajaran untuk TP: "${tp}"`,
  });
  return cleanAndParseJson(response.text);
};

export const generateRPMContent = async (tp: string, materi: string, kelas: string, praktikPedagogis: string, alokasiWaktu: string, jumlahPertemuan: number = 1, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const prompt = `Susun narasi Rencana Pembelajaran Mendalam (RPM) untuk TOTAL ${jumlahPertemuan} pertemuan.
  TUJUAN PEMBELAJARAN: "${tp}"
  MATERI UTAMA: "${materi}"
  MODEL: ${praktikPedagogis}
  
  WAJIB gunakan label "Pertemuan 1:", "Pertemuan 2:", dst.`;

  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          kemitraan: { type: Type.STRING },
          lingkunganBelajar: { type: Type.STRING },
          pemanfaatanDigital: { type: Type.STRING },
          kegiatanAwal: { type: Type.STRING },
          kegiatanInti: { type: Type.STRING },
          kegiatanPenutup: { type: Type.STRING }
        }
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const generateJournalNarrative = async (kelas: string, mapel: string, materi: string, refRpm?: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  let contextPrompt = `Tulis narasi log jurnal harian mengajar untuk SD Kelas ${kelas}, Mapel ${mapel}, Materi ${materi}.`;
  
  if (refRpm) {
    contextPrompt += `
    BERIKUT ADALAH REFERENSI RPM (Rencana Pembelajaran Mendalam):
    Model: ${refRpm.praktikPedagogis}
    Kegiatan Awal: ${refRpm.kegiatanAwal}
    Kegiatan Inti: ${refRpm.kegiatanInti}
    Kegiatan Penutup: ${refRpm.kegiatanPenutup}
    
    TUGAS:
    Ringkas langkah-langkah di atas menjadi 1 paragraf narasi detail kegiatan yang mencakup elemen Awal, Inti, dan Penutup secara padat (summary).
    Pastikan 'pedagogik' sesuai dengan Model pada RPM.`;
  }

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { 
          detail_kegiatan: { type: Type.STRING, description: "Ringkasan narasi langkah pembelajaran" }, 
          pedagogik: { type: Type.STRING, description: "Nama model/metode pembelajaran" } 
        }
      }
    },
    contents: contextPrompt,
  });
  return cleanAndParseJson(response.text);
};

export const generateAssessmentDetails = async (tp: string, materi: string, kelas: string, stepsContext: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const prompt = `Susun instrumen asesmen lengkap untuk SD Kelas ${kelas}.
  TP: "${tp}"
  MATERI: "${materi}"
  CONTEXT: "${stepsContext}"`;

  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            kategori: { type: Type.STRING },
            teknik: { type: Type.STRING },
            bentuk: { type: Type.STRING },
            instruksi: { type: Type.STRING },
            soalAtauTugas: { type: Type.STRING },
            rubrikDetail: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  aspek: { type: Type.STRING },
                  level4: { type: Type.STRING },
                  level3: { type: Type.STRING },
                  level2: { type: Type.STRING },
                  level1: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const generateLKPDContent = async (rpm: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const jumlah = rpm.jumlahPertemuan || 1;
  const prompt = `Bertindaklah sebagai pengembang bahan ajar SD. Susun Lembar Kerja Peserta Didik (LKPD) yang SINKRON dengan rincian langkah pada RPM berikut for TOTAL ${jumlah} pertemuan:
  
  TP: "${rpm.tujuanPembelajaran}"
  MATERI: "${rpm.materi}"
  LANGKAH RPM: 
  Awal: ${rpm.kegiatanAwal}
  Inti: ${rpm.kegiatanInti}
  Penutup: ${rpm.kegiatanPenutup}

  INSTRUKSI TEKNIS:
  1. Anda WAJIB menyusun konten untuk SELURUH ${jumlah} pertemuan secara detail.
  2. Untuk kolom 'materiRingkas', 'langkahKerja', dan 'tugasMandiri', gunakan label pemisah "Pertemuan 1:", "Pertemuan 2:", dst.
  3. Materi ringkas harus berisi poin penting yang akan dipelajari di pertemuan tersebut.
  4. Langkah kerja harus berisi instruksi tugas praktis untuk siswa (sinkron dengan Langkah Inti di RPM).
  5. Tantangan Mandiri harus berisi 1-3 tugas kreatif untuk dikerjakan siswa.
  6. Gunakan bahasa ramah anak SD.`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          petunjuk: { type: Type.STRING },
          alatBahan: { type: Type.STRING },
          materiRingkas: { type: Type.STRING, description: "Rincian materi dipisah per pertemuan dengan label Pertemuan X:" },
          langkahKerja: { type: Type.STRING, description: "Langkah tugas dipisah per pertemuan dengan label Pertemuan X:" },
          tugasMandiri: { type: Type.STRING, description: "Tantangan tugas dipisah per pertemuan dengan label Pertemuan X:" },
          refleksi: { type: Type.STRING }
        }
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const generateIndikatorSoal = async (item: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const prompt = `Buat 1 baris indikator soal AKM yang spesifik untuk SD Kelas ${item.kelas} berdasarkan Tujuan Pembelajaran berikut: "${item.tujuanPembelajaran}".
  
  ATURAN PENULISAN WAJIB:
  Gunakan format: "Disajikan [Teks/Bacaan/Tabel/Gambar], siswa dapat [Kompetensi/Tujuan yang ingin diukur]".
  
  Contoh: "Disajikan sebuah paragraf tentang ekosistem, siswa dapat mengidentifikasi peran produsen dalam rantai makanan dengan tepat."
  
  Hanya berikan teks indikatornya saja tanpa penjelasan tambahan.`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt
  });
  return response.text || "";
};

export const generateButirSoal = async (item: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const prompt = `Susunlah sebuah butir soal asesmen SD Kelas ${item.kelas} yang sejalan dengan Indikator Soal berikut: "${item.indikatorSoal}".
  
  INSTRUKSI:
  1. Buat stimulus berupa teks bacaan, data tabel, atau deskripsi gambar jika indikator memintanya.
  2. Susun pertanyaan yang menantang (HOTS) sesuai level kognitif indikator.
  3. Sertakan kunci jawaban yang benar.
  4. Bentuk soal saat ini adalah: ${item.bentukSoal}.
  
  KHUSUS BENTUK "MENJODOHKAN":
  Wajib gunakan format tabel markdown seperti ini untuk bagian soal:
  | Kolom Kiri | | Kolom Kanan |
  | Mewarnai | | me war na i |
  | Komodo | | ko mo do |
  dst...`;

  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          stimulus: { type: Type.STRING, description: "Teks bacaan, data tabel, atau narasi gambar pendukung soal" },
          soal: { type: Type.STRING, description: "Pertanyaan dan pilihan jawaban (Wajib gunakan format tabel | untuk Menjodohkan)" },
          kunci: { type: Type.STRING, description: "Kunci jawaban benar" }
        },
        required: ["soal", "kunci"]
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const generateAiImage = async (context: string, kelas: Kelas, kunci?: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      config: { imageConfig: { aspectRatio: "1:1" } },
      contents: { parts: [{ text: `Flat education clipart SD Kelas ${kelas}: ${context.substring(0, 100)}` }] },
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) { console.error(e); }
  return null;
};
