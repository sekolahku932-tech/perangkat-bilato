
import { GoogleGenAI, Type } from "@google/genai";
import { UploadedFile, Kelas } from "../types";

/**
 * Fungsi ekstraksi JSON yang ditingkatkan kekuatannya.
 */
const cleanAndParseJson = (str: string): any => {
  try {
    // Bersihkan karakter kontrol dan spasi aneh
    let cleaned = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();

    // Temukan blok JSON terdalam (mencegah teks tambahan di luar JSON merusak parser)
    const firstOpen = cleaned.indexOf('{');
    const lastClose = cleaned.lastIndexOf('}');
    
    if (firstOpen === -1 || lastClose === -1 || lastClose < firstOpen) {
      // Jika format hancur total, coba bersihkan markdown
      const fallback = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(fallback);
    }

    const jsonPart = cleaned.substring(firstOpen, lastClose + 1);
    return JSON.parse(jsonPart);
  } catch (e: any) {
    console.error("JSON Parse Failure:", e);
    console.error("Payload attempted:", str);
    throw new Error("Respon AI terputus atau tidak lengkap. Hal ini biasanya karena gangguan jaringan. Silakan klik tombol 'Wand' kembali.");
  }
};

const getAiClient = (apiKey?: string) => {
  const finalKey = apiKey || process.env.API_KEY || "";
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
    config: { systemInstruction: "Pakar kurikulum SD. Jawaban ringkas." }
  });
  return response.text || "AI tidak memberikan respon.";
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
    contents: `Analisis CP ini menjadi TP linear untuk SD Kelas ${kelas}: "${cpContent}".`,
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
    contents: `Lengkapi ATP: TP: "${tp}" | Materi: "${materi}".`,
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
    contents: `Rekomendasi model pembelajaran SD untuk TP: "${tp}"`,
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
    contents: `Susun RPM SD Kelas ${kelas}. TP: "${tp}", Materi: "${materi}", Model: "${praktikPedagogis}".`,
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
    contents: `Narasi jurnal guru SD. Mapel: ${mapel}. Topik: ${materi}.`,
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
    contents: `Susun 3 instrumen asesmen SD Kelas ${kelas}. TP: "${tp}".`,
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
    contents: `Susun LKPD SD. TP: "${rpm.tujuanPembelajaran}".`,
  });
  return cleanAndParseJson(response.text || '{}');
};

export const generateIndikatorSoal = async (item: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  const prompt = `Buatlah 1 kalimat Indikator Soal untuk SD Kelas ${item.kelas}. 
  TP: "${item.tujuanPembelajaran}"
  WAJIB gunakan format: "Disajikan Teks/Bacaan/Gambar siswa dapat ...."`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt
  });
  return response.text || "";
};

export const generateButirSoal = async (item: any, apiKey?: string) => {
  const ai = getAiClient(apiKey);
  
  let structureHint = "";
  if (item.bentukSoal === 'Pilihan Ganda') {
    structureHint = `
    WAJIB UNTUK PILIHAN GANDA:
    1. Masukkan pertanyaan di field 'soal'.
    2. Masukkan 4 pilihan jawaban: A, B, C, D.
    3. SETIAP label (A., B., C., D.) WAJIB berada di baris baru.
    `;
  } else if (item.bentukSoal === 'Pilihan Ganda Kompleks') {
    if (item.subBentukSoal === 'Grid') {
      structureHint = `
      WAJIB UNTUK PILIHAN GANDA KOMPLEKS (Tipe GRID/ASOSIASI):
      1. Field 'stimulus' (Teks Bacaan) HANYA berisi narasi atau data teks.
      2. Field 'soal' diawali kalimat instruksi: "Berdasarkan teks tersebut, tentukan Benar atau Salah pada setiap pernyataan berikut!"
      3. DILARANG menggunakan kata 'stimulus' dalam instruksi soal. Gunakan kata 'Teks' atau 'Bacaan' atau 'Informasi'.
      4. SETELAH instruksi di field 'soal', buat TABEL MARKDOWN dengan header PERSIS: | Pernyataan | Benar | Salah |
      5. Isi minimal 4-5 baris pernyataan.
      6. Contoh isi field 'soal':
         Berdasarkan teks tersebut, tentukan Benar atau Salah pada setiap pernyataan berikut!
         | Pernyataan | Benar | Salah |
         | Ibu membeli 5 kg beras | | |
         | Harga beras adalah Rp 10.000 | | |
      `;
    } else {
      structureHint = `
      WAJIB UNTUK PILIHAN GANDA KOMPLEKS (Multiple Answer):
      1. Field 'stimulus' (Teks Bacaan) HANYA berisi narasi atau data.
      2. Field 'soal' WAJIB diawali Kalimat Pertanyaan (contoh: "Berdasarkan teks tersebut, pilihlah semua pernyataan yang benar...").
      3. DILARANG menggunakan kata 'stimulus' dalam instruksi soal. Gunakan 'Teks' atau 'Informasi'.
      4. SETELAH kalimat pertanyaan di field 'soal', masukkan pilihan jawaban format [] di setiap awal baris.
      `;
    }
  } else if (item.bentukSoal === 'Menjodohkan') {
    structureHint = `
    WAJIB UNTUK MENJODOHKAN:
    1. Field 'stimulus' (Teks Bacaan/Informasi) HANYA berisi narasi data.
    2. Field 'soal' diawali kalimat instruksi: "Berdasarkan teks tersebut, jodohkanlah pernyataan di sebelah kiri dengan pilihan yang tepat di sebelah kanan!"
    3. DILARANG menggunakan kata 'stimulus'. Gunakan 'Teks'.
    4. Gunakan TABEL MARKDOWN 3 KOLOM dengan kolom tengah KOSONG.
    5. Format header WAJIB: | Pernyataan | | Pilihan Jawaban |
    6. BARIS DATA harus murni isi, jangan masukkan kata 'Pernyataan' atau 'Pilihan' lagi di baris data.
    7. Minimal 5 pasang penjodohan yang logis.
    `;
  }

  const prompt = `Buatlah 1 butir soal Asesmen SD Kelas ${item.kelas} (Level Hots/AKM).
  INDIKATOR: "${item.indikatorSoal}"
  BENTUK: "${item.bentukSoal}"
  ${structureHint}
  WAJIB: Jawab HANYA dalam JSON valid. Jangan menggunakan kata 'stimulus'.`;

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
      },
      thinkingConfig: { thinkingBudget: 0 }
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
