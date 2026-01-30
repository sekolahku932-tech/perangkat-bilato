
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

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
};

// Menggunakan Flash sebagai default untuk stabilitas Rate Limit (429) yang lebih baik
const DEFAULT_MODEL = 'gemini-3-flash-preview';
const COMPLEX_MODEL = 'gemini-3-flash-preview'; // Dialihkan ke Flash karena limit Pro sangat ketat di paket gratis
const IMAGE_MODEL = 'gemini-2.5-flash-image';

/**
 * Helper function untuk menangani retry saat terkena limit 429
 */
async function callWithRetry(fn: () => Promise<any>, retries = 3, delay = 2000): Promise<any> {
  try {
    return await fn();
  } catch (error: any) {
    if (error.message?.includes('429') && retries > 0) {
      console.warn(`Rate limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const startAIChat = async (systemInstruction: string) => {
  const ai = getAiClient();
  return ai.chats.create({
    model: DEFAULT_MODEL,
    config: { systemInstruction, temperature: 0.7 },
  });
};

export const analyzeDocuments = async (files: UploadedFile[], prompt: string) => {
  const ai = getAiClient();
  const fileParts = files.map(file => ({
    inlineData: { data: file.base64.split(',')[1], mimeType: file.type }
  }));
  
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: { parts: [...fileParts, { text: prompt }] },
      config: { systemInstruction: "Pakar Kurikulum SD Indonesia. Analisis dokumen dengan tajam dan solutif." }
    });
    return response.text || "AI tidak merespon.";
  });
};

export const analyzeCPToTP = async (cpContent: string, elemen: string, fase: string, kelas: string) => {
  const ai = getAiClient();
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

  return callWithRetry(async () => {
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
  });
};

export const completeATPDetails = async (tp: string, materi: string, kelas: string) => {
  const ai = getAiClient();
  const prompt = `Lengkapi rincian Alur Tujuan Pembelajaran (ATP) SD Kelas ${kelas}.
  Tujuan Pembelajaran (TP): "${tp}"
  Materi Utama: "${materi}"`;

  return callWithRetry(async () => {
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
  });
};

export const recommendPedagogy = async (tp: string, alurAtp: string, materi: string, kelas: string) => {
  const ai = getAiClient();
  return callWithRetry(async () => {
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
  });
};

export const generateRPMContent = async (tp: string, materi: string, kelas: string, praktikPedagogis: string, alokasiWaktu: string, jumlahPertemuan: number = 1) => {
  const ai = getAiClient();
  const prompt = `Susun narasi Rencana Pembelajaran Mendalam (RPM) untuk TOTAL ${jumlahPertemuan} pertemuan.
  TUJUAN PEMBELAJARAN: "${tp}"
  MATERI UTAMA: "${materi}"
  MODEL: ${praktikPedagogis}

  INSTRUKSI KHUSUS FORMAT NARASI:
  1. WAJIB gunakan label "Pertemuan 1:", "Pertemuan 2:", dst.
  2. Di setiap AKHIR kalimat instruksi kegiatan, WAJIB tambahkan salah satu tag berikut: [Berkesadaran], [Bermakna], atau [Menggembirakan] sesuai nuansa kegiatannya.
  3. Bagian INTI wajib memiliki sub-header naratif: "A. MEMAHAMI", "B. MENGAPLIKASI", "C. MEREFLEKSI".
  4. Berikan detail aktivitas yang panjang and deskriptif antara guru dan siswa.`;

  return callWithRetry(async () => {
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
  });
};

export const generateJournalNarrative = async (kelas: string, mapel: string, materi: string, refRpm?: any) => {
  const ai = getAiClient();
  let contextPrompt = `Tulis narasi log jurnal harian mengajar untuk SD Kelas ${kelas}, Mapel ${mapel}, Materi ${materi}.`;
  
  if (refRpm) {
    contextPrompt += `
    BERIKUT ADALAH REFERENSI RPM:
    Model: ${refRpm.praktikPedagogis}
    Kegiatan Awal: ${refRpm.kegiatanAwal}
    Kegiatan Inti: ${refRpm.kegiatanInti}
    Kegiatan Penutup: ${refRpm.kegiatanPenutup}
    
    TUGAS:
    Ringkas langkah-langkah di atas menjadi 1 paragraf narasi detail kegiatan.`;
  }

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { 
            detail_kegiatan: { type: Type.STRING }, 
            pedagogik: { type: Type.STRING } 
          }
        }
      },
      contents: contextPrompt,
    });
    return cleanAndParseJson(response.text);
  });
};

export const generateAssessmentDetails = async (tp: string, materi: string, kelas: string, stepsContext: string) => {
  const ai = getAiClient();
  const prompt = `Susun instrumen asesmen lengkap untuk SD Kelas ${kelas}. TP: "${tp}" MATERI: "${materi}" CONTEXT: "${stepsContext}"`;

  return callWithRetry(async () => {
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
  });
};

export const generateLKPDContent = async (rpm: any) => {
  const ai = getAiClient();
  const prompt = `Susun LKPD for TP: "${rpm.tujuanPembelajaran}" MATERI: "${rpm.materi}" LANGKAH: Awal: ${rpm.kegiatanAwal} Inti: ${rpm.kegiatanInti} Penutup: ${rpm.kegiatanPenutup}`;

  return callWithRetry(async () => {
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
      contents: prompt,
    });
    return cleanAndParseJson(response.text);
  });
};

export const generateIndikatorSoal = async (item: any) => {
  const ai = getAiClient();
  const prompt = `Buat 1 baris indikator soal AKM untuk TP: "${item.tujuanPembelajaran}". Gunakan format: Disajikan ..., siswa dapat ...`;
  
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt
    });
    return response.text || "";
  });
};

export const generateButirSoal = async (item: any) => {
  const ai = getAiClient();
  const prompt = `Susun soal SD Kelas ${item.kelas} berdasarkan indikator: "${item.indikatorSoal}". Bentuk: ${item.bentukSoal}.`;
  
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: COMPLEX_MODEL,
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
      contents: prompt,
    });
    return cleanAndParseJson(response.text);
  });
};

export const generateAiImage = async (context: string, kelas: Kelas) => {
  const ai = getAiClient();
  return callWithRetry(async () => {
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
  });
};
