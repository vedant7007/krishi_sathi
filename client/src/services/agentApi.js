import api from './api';

export const getAgentToken = () =>
  api.post('/agent/token').then((res) => res.data);

export const getAgentContext = () =>
  api.post('/agent/context').then((res) => res.data);

export const processVoiceQuery = (text, language, history = []) =>
  api.post('/agent/process', { text, language, history }).then((res) => res.data);

export const generateTTS = (text, language) =>
  api
    .post('/agent/tts', { text, language }, { responseType: 'blob' })
    .then((res) => res.data);

export const requestCallback = () =>
  api.post('/agent/request-callback').then((res) => res.data);

export const getSTTToken = () =>
  api.get('/chat/stt-token').then((res) => res.data);
