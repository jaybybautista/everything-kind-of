import axios from 'axios';
import 'dotenv/config';
export async function generate(prompt, generationConfig = {}) {
  if (!process.env.GEMINI_API_KEY?.trim()) throw Object.assign(new Error('Gemini is not configured. Add the API key on the server.'), { status: 503 });
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  if (!/^[a-zA-Z0-9.-]+$/.test(model)) throw Object.assign(new Error('The configured Gemini model name is invalid.'), { status: 503 });
  const { data } = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig,
  }, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY }, timeout: 90000 });
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('').trim();
  if (!text || candidate?.finishReason !== 'STOP') throw Object.assign(new Error(candidate?.finishReason === 'MAX_TOKENS' ? 'The response was too long. Try a shorter selection or brief detail.' : 'Gemini could not generate a response for this passage. Try adjusting your request.'), { status: 502 });
  return text;
}
export function publicError(error) {
  const upstream = error.response?.status;
  if (upstream === 429) return { status: 429, error: 'Gemini quota or rate limit reached. Wait a moment, or check your Google AI Studio quota.' };
  if (upstream === 503) return { status: 503, error: 'Gemini is experiencing high demand. Please try again in a moment. Your chapter has not been changed.' };
  if ([400, 401, 403].includes(upstream)) return { status: 503, error: 'Gemini rejected the request. Check the server API key, key restrictions, and model access.' };
  if (upstream === 404) return { status: 503, error: 'The configured Gemini model is unavailable. Update GEMINI_MODEL on the server.' };
  if (error.code === 'ECONNABORTED') return { status: 504, error: 'Gemini took too long. Try again with a shorter passage.' };
  if (error.status) return { status: error.status, error: error.message };
  return { status: 502, error: 'The writing assistant could not connect. Your chapter has not been changed. Please try again.' };
}
export const suggestionSchema = {
  type: 'OBJECT', required: ['contextSummary', 'suggestions', 'continuityNotes'], properties: {
    contextSummary: { type: 'STRING' }, continuityNotes: { type: 'ARRAY', items: { type: 'STRING' } },
    suggestions: { type: 'ARRAY', items: { type: 'OBJECT', required: ['title', 'angle', 'rationale', 'outline', 'text'], properties: {
      title: { type: 'STRING' }, angle: { type: 'STRING' }, rationale: { type: 'STRING' },
      outline: { type: 'ARRAY', items: { type: 'STRING' } }, text: { type: 'STRING' },
    } } },
  },
};
