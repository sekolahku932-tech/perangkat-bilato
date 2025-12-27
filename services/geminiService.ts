
import { GoogleGenAI, Type } from "@google/genai";
import { UploadedFile } from "../types";

const getSystemApiKey = () => {
  return process.env.API_KEY || null;
};

const DEFAULT_MODEL = 'gemini-3-flash-preview';

/**
 * Membuat instance AI baru menggunakan kunci yang tersedia.
 * Prioritas: Kunci User > Kunci Sistem.
 */
const createAIInstance = (customKey?: string) => {
  const apiKey = customKey || getSystemApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }
  return new GoogleGenAI({ apiKey });
};

const withRetry = async <T>(fn: (ai: GoogleGenAI) => Promise<T>, customKey?: string, maxRetries = 3): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const ai = createAIInstance(customKey);
      return await fn(ai);
    } catch (error: any) {
      lastError = error;
      const errorStr = JSON.stringify(error).toLowerCase();
      const isQuotaError = errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('resource_exhausted');
      if (isQuotaError && i < maxRetries - 1) {
        const delay = Math.pow(2, i + 2) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (errorStr.includes('400') || errorStr.includes('invalid') || errorStr.includes('key not found')) {
        throw new Error('INVALID_API_KEY');
      }
      if (isQuotaError) throw new Error('QUOTA_EXCEEDED');
      throw error;
    }
  }
  throw lastError;
};

export const startAIChat = async (systemInstruction: string, apiKey?: string) => {
  const ai = createAIInstance(apiKey);
  return ai.chats.create({
    model: DEFAULT_MODEL,
    config: { systemInstruction, temperature: 0.7 },
  });
};

export const analyzeDocuments = async (files: UploadedFile[], prompt: string, apiKey?: string) => {
  return withRetry(async (ai) => {
    const fileParts = files.map(file => ({
      inlineData: {
        data: file.base64.split(',')[1],
        mimeType: file.type
      }
    }));
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: { parts: [...fileParts, { text: prompt }] },
      config: { systemInstruction: "Anda adalah pakar kurikulum SD. Berikan jawaban yang sangat ringkas dan padat." }
    });
    return response.text || "AI tidak memberikan respon teks.";
  }, apiKey);
};

export const analyzeCPToTP = async (cpContent: string, elemen: string, fase: string, kelas: string, apiKey?: string) => {
  return withRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Pisahkan CP ini menjadi TP linear SD Kelas ${kelas}: "${cpContent}".`,
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
          },
        }
      }
    });
    return JSON.parse(response.text || '[]');
  }, apiKey);
};

export const completeATPDetails = async (tp: string, materi: string, kelas: string, apiKey?: string) => {
  return withRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Lengkapi ATP secara ringkas. TP: ${tp}.`,
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
      }
    });
    return JSON.parse(response.text || '{}');
  }, apiKey);
};

export const recommendPedagogy = async (tp: string, alurAtp: string, materi: string, kelas: string, apiKey?: string) => {
  return withRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Rekomendasi model pembelajaran singkat untuk TP: "${tp}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            modelName: { type: Type.STRING },
            reason: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  }, apiKey);
};

export const generateRPMContent = async (tp: string, materi: string, kelas: string, praktikPedagogis: string, alokasiWaktu: string, jumlahPertemuan: number = 1, apiKey?: string) => {
  return withRetry(async (ai) => {
    const prompt = `Buat konten RPM SD Kelas ${kelas} (Deep Learning). 
    TP: "${tp}" | Materi: "${materi}" | Model: "${praktikPedagogis}" | Pertemuan: ${jumlahPertemuan}.

    Format JSON:
    {
      "praktikPedagogis": "Nama Model",
      "kemitraan": "Singkat",
      "lingkunganBelajar": "Singkat",
      "pemanfaatanDigital": "Singkat",
      "kegiatanAwal": "Pertemuan 1:\\n1. ...",
      "kegiatanInti": "Pertemuan 1:\\n1. ...",
      "kegiatanPenutup": "Pertemuan 1:\\n1. ..."
    }`;
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
    });
    return JSON.parse(response.text || '{}');
  }, apiKey);
};

export const generateAssessmentDetails = async (tp: string, materi: string, kelas: string, narasiAwal: string, narasiProses: string, narasiAkhir: string, apiKey?: string) => {
  return withRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Buat 3 rubrik asesmen singkat untuk TP: "${tp}".`,
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
        },
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text || "[]";
  }, apiKey);
};

export const generateLKPDContent = async (rpm: any, apiKey?: string) => {
  return withRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Susun LKPD ringkas. Materi: ${rpm.materi}.`,
      config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
    });
    return JSON.parse(response.text || '{}');
  }, apiKey);
};

export const generateIndikatorSoal = async (item: any, apiKey?: string) => {
  return withRetry(async (ai) => {
    const isNonTes = item.jenis === 'Non Tes';
    const prompt = isNonTes 
      ? `Buat 1 kalimat indikator pengamatan perilaku/sikap untuk instrumen NON-TES jenjang SD. TP: "${item.tujuanPembelajaran}".`
      : `Buat 1 kalimat indikator soal AKM jenjang SD. TP: "${item.tujuanPembelajaran}".`;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text?.trim() || "";
  }, apiKey);
};

export const generateButirSoal = async (item: any, apiKey?: string) => {
  return withRetry(async (ai) => {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Buat 1 butir soal/instrumen untuk TP: "${item.tujuanPembelajaran}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stimulus: { type: Type.STRING },
            soal: { type: Type.STRING },
            kunci: { type: Type.STRING }
          },
          required: ['stimulus', 'soal', 'kunci']
        }
      }
    });
    return JSON.parse(response.text || '{"stimulus": "", "soal": "", "kunci": ""}');
  }, apiKey);
};
