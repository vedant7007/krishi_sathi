import api from './api';

/**
 * Send a chat message to the AI assistant.
 * @param {object} data - { message, language, context }
 */
export const sendChatMessage = (data) =>
  api.post('/chat', data).then((res) => res.data);
