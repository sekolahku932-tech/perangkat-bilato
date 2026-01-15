
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
    contents: `Analisis CP Kelas ${kelas}: "${cpContent}"`,
  });
  return cleanAndParseJson(response.text);
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
    contents: `Lengkapi detail ATP: TP "${tp}"`,
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
  const prompt = `Susun RPM SD Kelas ${kelas} untuk ${jumlahPertemuan} pertemuan secara spesifik dan terurai dengan kalimat yang PANJANG dan NARATIF.
  TP: "${tp}"
  MATERI: "${materi}"
  MODEL: ${praktikPedagogis}
  
  INSTRUKSI KHUSUS WAJIB:
  1. JABARKAN aktivitas dengan kalimat yang lebih panjang, lengkap, dan deskriptif (menguraikan rincian interaksi guru dan siswa secara nyata).
  2. JANGAN PERNAH menuliskan kembali judul bagian (seperti "I. MEMAHAMI", "II. MENGAPLIKASI", "III. MEREFLEKSI", "Sintaks [Nama Model]", atau "Langkah [Nomor]") di awal teks narasi karena UI sudah menyediakannya.
  3. LANGSUNG mulai pada rincian isi aktivitas tanpa basa-basi judul bagian.
  4. SETIAP PERTEMUAN (pertemuan 1, 2, dst) pada bagian Awal (MEMAHAMI) WAJIB dimulai dengan rincian naratif berikut (tuliskan masing-masing dalam kalimat panjang):
     - Guru mengawali pembelajaran dengan mengajak seluruh siswa melakukan doa pembuka bersama dan memanjatkan rasa syukur kepada Tuhan YME untuk menciptakan ketenangan batin. [Berkesadaran]
     - Guru melakukan pemeriksaan kehadiran atau absensi siswa satu per satu sambil memberikan sapaan hangat untuk memastikan kesiapan fisik dan emosional setiap anak sebelum belajar. [Berkesadaran]
     - Guru menyampaikan secara jelas Tujuan Pembelajaran yang ingin dicapai pada hari ini beserta relevansi materi tersebut dalam kehidupan nyata siswa agar pembelajaran menjadi lebih terarah. [Bermakna]
  5. Uraikan langkah-langkah selanjutnya sesuai sintaks model "${praktikPedagogis}" secara mendalam dan berurut ke bawah.
  6. Gunakan format penomoran "Pertemuan X:" untuk memisahkan konten antar pertemuan jika jumlahPertemuan > 1.
  7. Di dalam setiap rincian aktivitas, sertakan label filosofi kurikulum merdeka: [Berkesadaran], [Bermakna], atau [Menggembirakan] pada akhir kalimat yang relevan.
  8. Struktur 3M sebagai Bingkai Utama (Langsung isi rincian per bagian):
     - Memahami (Awal/Appersepsi/Ritual Pembuka)
     - Mengaplikasi (Inti/Eksplorasi sesuai Sintaks Model)
     - Merefleksi (Penutup/Simpulan/Selebrasi)`;

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
          kegiatanAwal: { type: Type.STRING, description: "Rincian ritual doa, absensi, dan TP yang diuraikan secara naratif panjang" },
          kegiatanInti: { type: Type.STRING, description: "Jabarkan rincian langkah sintaks model pembelajaran secara naratif panjang dan vertikal" },
          kegiatanPenutup: { type: Type.STRING, description: "Rincian langkah refleksi dan selebrasi secara naratif panjang" }
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
  
  CONTEXT LANGKAH PEMBELAJARAN (SINKRONKAN DENGAN INI):
  "${stepsContext}"
  
  INSTRUKSI:
  1. Instrumen asesmen harus selaras dan sinkron dengan narasi aktivitas pembelajaran di atas.
  2. ASESMEN PROSES (Formatif) harus mengukur aktivitas spesifik yang nyata dilakukan siswa dalam langkah tersebut.
  3. Gunakan teknik dan bentuk yang variatif sesuai Kurikulum Merdeka.
  4. Rubrik harus memiliki kriteria yang jelas (Level 4 sampai 1).`;

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
