
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

const getAiClient = (providedApiKey?: string) => {
  const finalKey = (providedApiKey && providedApiKey.trim() !== "") 
    ? providedApiKey.trim() 
    : (process.env.API_KEY || "");
  return new GoogleGenAI({ apiKey: finalKey });
};

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const COMPLEX_MODEL = 'gemini-3-flash-preview'; 
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
  
  TUGAS:
  1. Pecah CP tersebut menjadi beberapa Tujuan Pembelajaran (TP) yang spesifik dan terukur.
  2. Tentukan Materi Pokok dan Sub Materi untuk setiap TP.
  3. Lakukan analisis karakter: Pilih 1-3 Dimensi Profil Lulusan yang paling relevan untuk setiap TP HANYA dari 8 daftar berikut:
     - Keimanan dan Ketakwaan
     - Kewargaan
     - Penalaran Kritis
     - Kreativitas
     - Kolaborasi
     - Kemandirian
     - Kesehatan
     - Komunikasi`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
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
            profilLulusan: { type: Type.STRING, description: "1-3 dimensi dari daftar resmi, pisahkan dengan koma." }
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
  Materi Utama: "${materi}"
  
  TUGAS KHUSUS DIMENSI PROFIL LULUSAN:
  Lakukan analisis mendalam terhadap kompetensi yang dituju oleh TP ini.
  Pilih 1-3 item yang paling relevan HANYA dari 8 Dimensi Profil Lulusan berikut:
  1. Keimanan dan Ketakwaan
  2. Kewargaan
  3. Penalaran Kritis
  4. Kreativitas
  5. Kolaborasi
  6. Kemandirian
  7. Kesehatan
  8. Komunikasi

  Sajikan juga rincian Alur Tujuan (ATP), Alokasi Waktu (JP), rancangan Asesmen (Awal, Proses, Akhir), dan Sumber Belajar.`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          alurTujuan: { type: Type.STRING },
          alokasiWaktu: { type: Type.STRING },
          dimensiOfProfil: { 
            type: Type.STRING, 
            description: "Hasil analisis: 1-3 dari 8 dimensi resmi. Pisahkan dengan koma." 
          },
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
  const prompt = `Susun RPM SD Kelas ${kelas} untuk TOTAL ${jumlahPertemuan} pertemuan.
  TP: "${tp}"
  MATERI: "${materi}"
  MODEL: ${praktikPedagogis}
  
  INSTRUKSI KHUSUS LANGKAH PEMBELAJARAN (WAJIB):
  1. Sajikan langkah pembelajaran dalam rincian butir-butir bernomor (1., 2., 3., dst) yang berurut ke bawah secara vertikal.
  2. SETIAP SATU BUTIR langkah harus berupa kalimat naratif yang PANJANG and DESKRIPTIF (min 20 kata).
  3. DI AKHIR SETIAP KALIMAT langkah, Anda WAJIB menyertakan salah satu label filosofi berikut: [Bermakna], [Menggembirakan], atau [Berkesadaran] (Pilih yang paling sesuai dengan aktivitasnya).
  4. Gunakan label "Pertemuan 1:", "Pertemuan 2:", dst untuk memisahkan sesi jika jumlahPertemuan > 1 di dalam kolom teks.
  5. JANGAN menuliskan kembali judul bagian (seperti "I. MEMAHAMI") di dalam teks isi.
  
  CONTOH FORMAT HASIL:
  Pertemuan 1:
  1. Guru mengajak siswa mengamati lingkungan sekitar sekolah untuk menemukan contoh nyata dari materi yang sedang dipelajari agar siswa memahami relevansinya dalam kehidupan sehari-hari. [Bermakna]
  2. Siswa secara berkelompok melakukan simulasi peran dengan antusiasme tinggi melalui permainan edukatif yang dirancang khusus untuk memperdalam pemahaman konsep secara seru. [Menggembirakan]
  3. Guru memberikan waktu hening sejenak bagi siswa untuk merefleksikan apa yang telah mereka rasakan dan pelajari hari ini guna menumbuhkan ketenangan batin. [Berkesadaran]`;

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
          kegiatanAwal: { type: Type.STRING, description: "Wajib label Pertemuan X:, butir bernomor, and akhiri [Bermakna]/[Menggembirakan]/[Berkesadaran]" },
          kegiatanInti: { type: Type.STRING, description: "Wajib label Pertemuan X:, butir bernomor, and akhiri [Bermakna]/[Menggembirakan]/[Berkesadaran]" },
          kegiatanPenutup: { type: Type.STRING, description: "Wajib label Pertemuan X:, butir bernomor, and akhiri [Bermakna]/[Menggembirakan]/[Berkesadaran]" }
        }
      }
    },
    contents: prompt,
  });
  return cleanAndParseJson(response.text);
};

export const generateJournalNarrative = async (kelas: string, mapel: string, materi: string, refRpm?: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { detail_kegiatan: { type: Type.STRING }, pedagogik: { type: Type.STRING } }
      }
    },
    contents: `Buat jurnal harian: Kelas ${kelas}, Mapel ${mapel}, Materi ${materi}.`,
  });
  return cleanAndParseJson(response.text);
};

export const generateAssessmentDetails = async (tp: string, materi: string, kelas: string, stepsContext: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const prompt = `Susun instrumen asesmen lengkap (Awal, Proses, Akhir) untuk SD Kelas ${kelas}.
  TP: "${tp}"
  MATERI: "${materi}"
  
  CONTEXT LANGKAH PEMBELAJARAN:
  "${stepsContext}"
  
  INSTRUKSI:
  1. Asesmen harus selaras dengan narasi butir aktivitas di atas.
  2. ASESMEN PROSES (Formatif) harus mengukur aktivitas spesifik dalam langkah.
  3. Gunakan teknik dan bentuk yang variatif sesuai Kurikulum Merdeka.`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            kategori: { type: Type.STRING, description: "ASESMEN AWAL, ASESMEN PROSES, atau ASESMEN AKHIR" },
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
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          petunjuk: { type: Type.STRING },
          alatBahan: { type: Type.STRING },
          materiRingkas: { type: Type.STRING },
          langkahKerja: { type: Type.STRING },
          tugasMandiri: { type: Type.STRING },
          refleksi: { type: Type.STRING }
        }
      }
    },
    contents: `Buat LKPD Sinkron RPM: "${rpm.tujuanPembelajaran}"`,
  });
  return cleanAndParseJson(response.text);
};

export const generateIndikatorSoal = async (item: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: `Buat indikator soal AKM Kelas ${item.kelas}: "${item.tujuanPembelajaran}"`
  });
  return response.text || "";
};

export const generateButirSoal = async (item: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          stimulus: { type: Type.STRING },
          soal: { type: Type.STRING },
          kunci: { type: Type.STRING }
        },
        required: ["soal", "kunci"]
      }
    },
    contents: `Buat soal untuk indikator: "${item.indikatorSoal}"`,
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
