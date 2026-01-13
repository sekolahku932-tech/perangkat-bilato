
import { GoogleGenAI, Type } from "@google/genai";
import { UploadedFile, Kelas } from "../types";

const cleanJsonString = (str: string): string => {
  return str.replace(/```json/g, '').replace(/```/g, '').trim();
};

const getAiClient = (userApiKey?: string) => {
  // Gunakan kunci user jika ada, jika tidak gunakan kunci default sistem
  return new GoogleGenAI({ apiKey: userApiKey || process.env.API_KEY });
};

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const COMPLEX_MODEL = 'gemini-3-pro-preview'; 
const IMAGE_MODEL = 'gemini-2.5-flash-image';

export const startAIChat = async (systemInstruction: string, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
  return ai.chats.create({
    model: DEFAULT_MODEL,
    config: { systemInstruction, temperature: 0.7 },
  });
};

export const analyzeDocuments = async (files: UploadedFile[], prompt: string, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
  const fileParts = files.map(file => ({
    inlineData: {
      data: file.base64.split(',')[1],
      mimeType: file.type
    }
  }));
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: { parts: [...fileParts, { text: prompt }] },
    config: { systemInstruction: "Pakar kurikulum SD. Jawaban ringkas dan profesional." }
  });
  return response.text || "AI tidak memberikan respon.";
};

export const analyzeCPToTP = async (cpContent: string, elemen: string, fase: string, kelas: string, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
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
  return JSON.parse(cleanJsonString(response.text || '[]'));
};

export const completeATPDetails = async (tp: string, materi: string, kelas: string, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
  const prompt = `Lengkapi detail ATP SD Kelas ${kelas}. TP: "${tp}" | Materi: "${materi}".`;

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
  return JSON.parse(cleanJsonString(response.text || '{}'));
};

export const recommendPedagogy = async (tp: string, alurAtp: string, materi: string, kelas: string, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
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
    contents: `Berikan 1 nama model pembelajaran paling relevan untuk TP SD: "${tp}"`,
  });
  return JSON.parse(cleanJsonString(response.text || '{}'));
};

export const generateRPMContent = async (tp: string, materi: string, kelas: string, praktikPedagogis: string, alokasiWaktu: string, jumlahPertemuan: number = 1, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
  const prompt = `Susun Rencana Pembelajaran Mendalam (RPM) SD Kelas ${kelas} dengan sangat DETAIL dan TERURAI. 
  
  REFERENSI UTAMA:
  - TP: "${tp}"
  - Materi: "${materi}"
  - Model Pembelajaran (Sintaks): "${praktikPedagogis}"
  - Jumlah Pertemuan: ${jumlahPertemuan}
  
  INSTRUKSI KHUSUS LANGKAH PEMBELAJARAN (3M):
  1. Uraikan langkah secara kronologis and sangat detail sesuai sintaks model "${praktikPedagogis}".
  2. FORMAT: Gunakan daftar bernomor vertikal (1., 2., 3., dst). 
  3. KRITIKAL: Setiap langkah harus berisi satu instruksi operasional yang JELAS (apa yang dilakukan guru & siswa).
  4. WAJIB: Di setiap AKHIR kalimat/langkah, berikan klasifikasi filosofis dalam kurung siku, pilih salah satu: [Menggembirakan], [Bermakna], atau [Berkesadaran].
  
  STRUKTUR OUTPUT (JSON):
  - kemitraan: Sebutkan pihak eksternal/lingkungan yang terlibat.
  - lingkunganBelajar: Penataan kelas/lokasi.
  - pemanfaatanDigital: Alat bantu digital yang dipakai.
  - kegiatanAwal: Langkah awal pemahaman (Min 3 langkah per pertemuan).
  - kegiatanInti: Langkah aplikasi sesuai sintaks model (Min 6 langkah per pertemuan).
  - kegiatanPenutup: Langkah refleksi (Min 3 langkah per pertemuan).`;

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
  return JSON.parse(cleanJsonString(response.text || '{}'));
};

export const generateJournalNarrative = async (kelas: string, mapel: string, materi: string, refRpm?: any, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
  let prompt = `Bantu susun narasi jurnal harian guru SD Kelas ${kelas}. Mapel: ${mapel}. Topik: ${materi}.`;
  
  if (refRpm) {
    prompt += `\nReferensi RPM: Model ${refRpm.praktikPedagogis}.`;
  }

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
    contents: prompt,
  });
  return JSON.parse(cleanJsonString(response.text || '{}'));
};

export const generateAssessmentDetails = async (tp: string, materi: string, kelas: string, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
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
    contents: `Susun 3 jenis instrumen asesmen LENGKAP (AWAL, PROSES, AKHIR) untuk SD Kelas ${kelas}. TP: "${tp}". Materi: "${materi}".`,
  });
  return cleanJsonString(response.text || '[]');
};

export const generateLKPDContent = async (rpm: any, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
  const count = rpm.jumlahPertemuan || 1;
  const prompt = `Susun Lembar Kerja Peserta Didik (LKPD) SD yang LENGKAP untuk ${count} PERTEMUAN.
  
  REFERENSI RPM:
  - TP: "${rpm.tujuanPembelajaran}"
  - Materi: "${rpm.materi}"
  - Langkah Inti (RPM): "${rpm.kegiatanInti}"
  
  ATURAN KHUSUS MULTI-PERTEMUAN:
  Jika jumlah pertemuan adalah ${count} (> 1), maka setiap properti di bawah ini (materiRingkas, langkahKerja, tugasMandiri, refleksi) WAJIB menggunakan penanda eksplisit "Pertemuan 1:", "Pertemuan 2:", dst. untuk memisahkan konten antar sesi.
  
  STRUKTUR OUTPUT (JSON):
  - petunjuk: Panduan umum mengerjakan LKPD.
  - alatBahan: Daftar alat and bahan dari RPM.
  - materiRingkas: Ringkasan materi.
  - langkahKerja: Langkah praktis siswa.
  - tugasMandiri: Tantangan spesifik / Tugas Mandiri.
  - refleksi: Pertanyaan refleksi siswa.`;

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
  return JSON.parse(cleanJsonString(response.text || '{}'));
};

export const generateIndikatorSoal = async (item: any, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
  const prompt = `Buatlah 1 kalimat Indikator Soal RINGKAS untuk SD Kelas ${item.kelas} berdasarkan TP berikut.
  
  TP: "${item.tujuanPembelajaran}"
  Level Kompetensi: "${item.kompetensi}"
  
  ATURAN: Gunakan struktur standar: "Disajikan [Gambar/Teks/dll], siswa dapat..."`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt
  });
  return response.text || "";
};

export const generateButirSoal = async (item: any, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
  
  let structureHint = "";
  if (item.bentukSoal === 'Menjodohkan') {
    structureHint = `
    ATURAN KHUSUS MENJODOHKAN:
    - Gunakan tabel markdown dengan tepat 3 kolom.
    - Header: | PERNYATAAN | | PILIHAN JAWABAN |
    - Kolom tengah kosongkan saja.
    `;
  } else if (item.bentukSoal === 'Pilihan Ganda Kompleks') {
    structureHint = `
    ATURAN PILIHAN GANDA KOMPLEKS:
    Bentuk soal ini dapat berupa:
    1. Memilih lebih dari 1 jawaban (Gunakan format daftar [] untuk pilihan).
    2. Benar Salah (Gunakan format TABEL Markdown: | PERNYATAAN | BENAR | SALAH |).
    3. Ya Tidak (Gunakan format TABEL Markdown: | PERNYATAAN | YA | TIDAK |).
    
    Pilih format yang paling relevan dengan indikator "${item.indikatorSoal}".
    Jika format daftar [], berikan minimal 5 pilihan.
    Jika format tabel, isi minimal 3-5 pernyataan.
    `;
  }

  const prompt = `Buatlah 1 butir soal Asesmen SD Kelas ${item.kelas} yang berkualitas tinggi sesuai Indikator.
  
  INDIKATOR: "${item.indikatorSoal}"
  BENTUK SOAL: "${item.bentukSoal}"
  ${structureHint}
  
  OUTPUT DALAM JSON:
  - stimulus: (Optional) Narasi pendukung soal/instruksi khusus.
  - soal: Kalimat soal lengkap dengan format yang diminta.
  - kunci: Jawaban benar.`;

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
        }
      }
    },
    contents: prompt,
  });
  return JSON.parse(cleanJsonString(response.text || '{}'));
};

export const generateAiImage = async (context: string, kelas: Kelas, kunci?: string, userApiKey?: string) => {
  const ai = getAiClient(userApiKey);
  
  // Prompt dioptimasi agar menghasilkan file yang lebih kecil (flat/clipart style) 
  // namun tetap relevan untuk anak SD.
  let visualPrompt = `Ultra-simple, minimalist flat 2D vector clipart for primary school kids (SD Kelas ${kelas}). 
  Topic: ${context.substring(0, 200)}. `;
  
  if (kunci) {
    visualPrompt += `Visual focus: Draw exactly the amount or objects matching the key "${kunci}". `;
  }

  visualPrompt += `Visual Style: Solid shapes, thick clean black outlines, high contrast bright colors, white solid background. 
  NO gradients, NO shadows, NO detailed textures, NO text. 
  Keep the image very simple and clean.`;

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    config: {
      imageConfig: { aspectRatio: "1:1" }
    },
    contents: { parts: [{ text: visualPrompt }] },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};
