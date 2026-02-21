import api from './api';

/**
 * Send a chat message to the AI assistant.
 * @param {object} data - { message, language, context, history }
 *   history is an optional array of the last N messages for conversation memory.
 */
export const sendChatMessage = (data) =>
  api.post('/chat', data).then((res) => res.data);

/**
 * Fetch a short-lived Deepgram API key for STT.
 * Backend endpoint: GET /api/chat/stt-token
 * Returns { key: string }
 */
export const getSTTToken = () =>
  api.get('/chat/stt-token').then((res) => res.data);

/**
 * Request Deepgram TTS audio for the given text.
 * Backend endpoint: POST /api/chat/tts
 * Expects { text, language } and returns an audio blob.
 */
export const getTTSAudio = (text, language) =>
  api
    .post('/chat/tts', { text, language }, { responseType: 'blob' })
    .then((res) => res.data);
