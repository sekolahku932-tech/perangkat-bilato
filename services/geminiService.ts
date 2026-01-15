
import { GoogleGenAI, Type } from "@google/genai";
import { UploadedFile, Kelas } from "../types";

/**
 * Fungsi ekstraksi JSON yang tangguh.
 */
const cleanAndParseJson = (str: string): any => {
  try {
    let cleaned = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
    const firstOpen = cleaned.indexOf('{');
    const lastClose = cleaned.lastIndexOf('}');
    if (firstOpen === -1 || lastClose === -1 || lastClose < firstOpen) {
      const fallback = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(fallback);
    }
    const jsonPart = cleaned.substring(firstOpen, lastClose + 1);
    return JSON.parse(jsonPart);
  } catch (e: any) {
    throw new Error("Respon AI tidak lengkap. Silakan coba klik tombol AI kembali.");
  }
};

/**
 * Mendapatkan client AI dengan memprioritaskan kunci yang diberikan (BYOK)
 * atau fallback ke kunci environment variabel di hosting.
 */
const getAiClient = (providedApiKey?: string) => {
  const finalKey = providedApiKey || process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey: finalKey });
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
    inlineData: {
      data: file.base64.split(',')[1],
      mimeType: file.type
    }
  }));
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: { parts: [...fileParts, { text: prompt }] },
    config: { systemInstruction: "Pakar kurikulum SD." }
  });
  return response.text || "AI tidak merespon.";
};

export const analyzeCPToTP = async (cpContent: string, elemen: string, fase: string, kelas: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
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
            tp: { type: Type.STRING }
          },
          required: ['materi', 'subMateri', 'tp']
        }
      }
    },
    contents: `Analisis CP: "${cpContent}" untuk Kelas ${kelas}.`,
  });
  return cleanAndParseJson(response.text || '[]');
};

export const completeATPDetails = async (tp: string, materi: string, kelas: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
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
    contents: `Lengkapi ATP: TP: "${tp}".`,
  });
  return cleanAndParseJson(response.text || '{}');
};

export const recommendPedagogy = async (tp: string, alurAtp: string, materi: string, kelas: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          modelName: { type: Type.STRING },
          reason: { type: Type.STRING }
        }
      }
    },
    contents: `Rekomendasi model pembelajaran SD: "${tp}"`,
  });
  return cleanAndParseJson(response.text || '{}');
};

export const generateRPMContent = async (tp: string, materi: string, kelas: string, praktikPedagogis: string, alokasiWaktu: string, jumlahPertemuan: number = 1, apiKey?: string) => {
  const ai = getAiClient(apiKey);
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
      },
      thinkingConfig: { thinkingBudget: 1000 }
    },
    contents: `Susun RPM SD Kelas ${kelas}. TP: "${tp}".`,
  });
  return cleanAndParseJson(response.text || '{}');
};

export const generateJournalNarrative = async (kelas: string, mapel: string, materi: string, refRpm?: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
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
    contents: `Jurnal guru: ${mapel} - ${materi}.`,
  });
  return cleanAndParseJson(response.text || '{}');
};

export const generateAssessmentDetails = async (tp: string, materi: string, kelas: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
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
    contents: `Susun instrumen asesmen: "${tp}".`,
  });
  return cleanAndParseJson(response.text || '[]');
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
    contents: `Susun LKPD: "${rpm.tujuanPembelajaran}".`,
  });
  return cleanAndParseJson(response.text || '{}');
};

export const generateIndikatorSoal = async (item: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const prompt = `Buat 1 kalimat Indikator Soal SD Kelas ${item.kelas}.\nTP: "${item.tujuanPembelajaran}"\nFormat: "Disajikan Teks/Gambar siswa dapat ...."`;
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt
  });
  return response.text || "";
};

export const generateButirSoal = async (item: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  let hint = "";
  if (item.bentukSoal === 'Pilihan Ganda') hint = "4 pilihan: A, B, C, D.";
  else if (item.bentukSoal === 'Pilihan Ganda Kompleks') hint = item.subBentukSoal === 'Grid' ? "Tabel Benar/Salah." : "Format [ ] di awal baris.";
  else if (item.bentukSoal === 'Menjodohkan') hint = "TABEL MARKDOWN 3 KOLOM: | Pernyataan | | Pilihan Jawaban |";

  const prompt = `Buat soal AKM SD Kelas ${item.kelas}.\nINDIKATOR: "${item.indikatorSoal}"\nBENTUK: "${item.bentukSoal}"\n${hint}\nWAJIB: JSON valid.`;
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
    contents: prompt,
  });
  return cleanAndParseJson(response.text || '{}');
};

export const generateAiImage = async (context: string, kelas: Kelas, kunci?: string, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    config: { imageConfig: { aspectRatio: "1:1" } },
    contents: { parts: [{ text: `Flat vector clipart SD Kelas ${kelas}: ${context.substring(0, 150)}` }] },
  });
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};
