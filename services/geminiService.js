import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const GEMINI_MODEL_OVERRIDE = process.env.GEMINI_MODEL?.trim();
const VERSIONS = ['v1beta', 'v1'];
const FALLBACK_MODELS = [
  // Prefer Gemini 2.0 Flash variants first (commonly enabled for free keys)
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-latest',
  'gemini-2.0-flash-lite-latest',
  // Then 1.5 Flash variants
  'gemini-1.5-flash-8b-latest',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b-001',
  'gemini-1.5-flash-001',
];
const MODEL_LIST = GEMINI_MODEL_OVERRIDE ? [GEMINI_MODEL_OVERRIDE, ...FALLBACK_MODELS] : FALLBACK_MODELS;
const GEMINI_ENDPOINTS = [];
for (const m of MODEL_LIST) {
  for (const v of VERSIONS) {
    GEMINI_ENDPOINTS.push(`https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent`);
  }
}

const promptTemplate = (title) => `You are a medical report summarizer. Analyze the provided content and return a strict JSON object with keys:
{
  "languageSummaries": {"en": string, "roman": string},
  "highlights": [{"key": string, "value": string, "flag": "high"|"low"|"normal"|"unknown"}],
  "doctorQuestions": [string, string, string],
  "dietTips": [string, string, string],
  "warnings": ["For education and understanding only — consult your doctor for treatment."]
}
- english summary: simple, 5-7 lines, include key abnormalities.
- roman urdu: accurate, easy-to-understand.
- highlights: only important lab/vital values that look abnormal or noteworthy.
- keep JSON valid, no extra commentary.
${title ? `Report Title: ${title}` : ''}`;

async function fetchAsBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

function inferMimeFromUrl(url, fallback = 'application/octet-stream') {
  const u = url.split('?')[0].toLowerCase();
  if (u.endsWith('.pdf')) return 'application/pdf';
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
  if (u.endsWith('.webp')) return 'image/webp';
  return fallback;
}

function buildCloudinaryPdfPreviewUrl(filePublicId) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud || !filePublicId) return null;
  // page 1 to JPEG preview of the PDF
  const encodedPublicId = encodeURI(filePublicId);
  return `https://res.cloudinary.com/${cloud}/image/upload/pg_1,f_jpg/${encodedPublicId}.jpg`;
}

async function postToGemini(body) {
  let lastErr;
  for (const EP of GEMINI_ENDPOINTS) {
    try {
      const url = `${EP}?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
      const { data } = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
      return data;
    } catch (err) {
      // Try next endpoint alias on 404 (model not found) only
      if (err?.response?.status === 404) {
        lastErr = { ...err, _endpoint: EP };
        continue;
      }
      throw err;
    }
  }
  // If we reach here, all endpoints returned 404
  const detail = lastErr?.response?.data || lastErr?.message || 'Model not found';
  const ep = lastErr?._endpoint || 'unknown-endpoint';
  throw new Error(`Gemini API 404 at ${ep}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

export async function analyzeFileWithGemini({ fileUrl, filePublicId = '', fileType = 'image', title = '' }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  let parts = [];

  const isPdf = String(fileType).toLowerCase() === 'pdf';
  try {
    let inlineUrl = fileUrl;
    let mimeType;
    if (isPdf) {
      // Prefer Cloudinary first-page JPEG preview for PDFs
      const preview = buildCloudinaryPdfPreviewUrl(filePublicId);
      if (preview) {
        inlineUrl = preview;
        mimeType = 'image/jpeg';
      } else {
        mimeType = 'application/pdf';
      }
    } else {
      mimeType = inferMimeFromUrl(fileUrl, 'image/png');
    }

    const buffer = await fetchAsBuffer(inlineUrl);
    const base64 = buffer.toString('base64');
    parts = [
      { text: promptTemplate(title) },
      { inline_data: { mime_type: mimeType, data: base64 } },
    ];
  } catch (err) {
    // Fallback: send the URL if fetch fails (may be less reliable)
    parts = [
      { text: promptTemplate(title) },
      { text: `File URL for analysis (fetch if allowed): ${fileUrl}` },
    ];
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
    },
  };

  const data = await postToGemini(body);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    parsed = {
      languageSummaries: { en: text?.slice(0, 3000) || '', roman: '' },
      highlights: [],
      doctorQuestions: [],
      dietTips: [],
      warnings: ['For education and understanding only — consult your doctor for treatment.'],
      rawModelResponse: data,
    };
  }

  return { parsed, raw: data };
}

export async function analyzeVitalsWithGemini({ values = {}, title = '' }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const prompt = `You are a medical assistant. Analyze the following patient's vitals JSON and return STRICT JSON with keys:\n{
    "languageSummaries": {"en": string, "roman": string},
    "assessment": string,
    "alerts": [{"key": string, "status": "high"|"low"|"normal"|"unknown", "reason": string}],
    "advice": [string],
    "followupQuestions": [string]
  }\n- english summary: simple, 4-6 lines, friendly.
  - roman urdu: accurate, easy to read.
  - keep JSON valid. No extra commentary.\n${title ? `Context Title: ${title}\n` : ''}Vitals JSON:\n${JSON.stringify(values).slice(0, 6000)}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: { temperature: 0.2, topK: 40, topP: 0.95 },
  };

  const data = await postToGemini(body);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    parsed = { languageSummaries: { en: text?.slice(0, 3000) || '', roman: '' }, assessment: '', alerts: [], advice: [], followupQuestions: [], rawModelResponse: data };
  }
  return { parsed, raw: data };
}
