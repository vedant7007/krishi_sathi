import { useState, useRef, useCallback, useEffect } from 'react';
import { processVoiceQuery, generateTTS, getSTTToken } from '../services/agentApi';

const DEEPGRAM_LANG = { en: 'en', hi: 'hi', te: 'te' };
const BROWSER_LANG = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' };

export default function useVoiceAgent(language = 'en') {
  const [status, setStatus] = useState('idle'); // idle | listening | processing | speaking
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const deepgramSocketRef = useRef(null);
  const audioRef = useRef(null);
  const finalAccumulatorRef = useRef('');
  const webSpeechRef = useRef(null);

  useEffect(() => {
    return () => {
      cleanupSTT();
      cleanupAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanupSTT = useCallback(() => {
    if (webSpeechRef.current) {
      try { webSpeechRef.current.abort(); } catch { /* */ }
      webSpeechRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* */ }
    }
    mediaRecorderRef.current = null;
    if (deepgramSocketRef.current) {
      if (deepgramSocketRef.current.readyState === WebSocket.OPEN) {
        try { deepgramSocketRef.current.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* */ }
      }
      deepgramSocketRef.current.close();
      deepgramSocketRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src?.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  // ─── Start Listening: Deepgram -> Web Speech API fallback ───
  const startListening = useCallback(async () => {
    try {
      setError(null);
      cleanupSTT();
      finalAccumulatorRef.current = '';
      setInterimTranscript('');
      setTranscript('');

      // Try Deepgram first
      const deepgramOk = await tryDeepgramSTT();
      if (deepgramOk) {
        setStatus('listening');
        if (navigator.vibrate) navigator.vibrate(50);
        return;
      }

      // Fallback: Web Speech API (Chrome built-in, works offline)
      console.log('[VoiceAgent] Deepgram failed, trying Web Speech API...');
      const webOk = tryWebSpeechAPI();
      if (webOk) {
        setStatus('listening');
        if (navigator.vibrate) navigator.vibrate(50);
        return;
      }

      setError('Speech recognition unavailable. Please type your question below.');
      setStatus('idle');
    } catch (err) {
      console.error('[VoiceAgent] startListening error:', err);
      cleanupSTT();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied. Please type your question.');
      } else {
        setError(err.message || 'Failed to start listening.');
      }
      setStatus('idle');
    }
  }, [language, cleanupSTT]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Deepgram WebSocket STT ───
  const tryDeepgramSTT = useCallback(async () => {
    try {
      const tokenData = await getSTTToken();
      const apiKey = tokenData?.data?.key || tokenData?.key || tokenData?.token || tokenData?.data?.token;
      if (!apiKey) {
        console.warn('[VoiceAgent] No STT token');
        return false;
      }
      console.log('[VoiceAgent] STT token OK, len:', apiKey.length);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const dgLang = DEEPGRAM_LANG[language] || 'en';
      const wsUrl = `wss://api.deepgram.com/v1/listen?language=${dgLang}&model=nova-2&smart_format=true&interim_results=true&endpointing=300`;

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[VoiceAgent] Deepgram timeout (5s)');
          resolve(false);
        }, 5000);

        const ws = new WebSocket(wsUrl, ['token', apiKey]);
        deepgramSocketRef.current = ws;

        ws.onopen = () => {
          clearTimeout(timeout);
          console.log('[VoiceAgent] Deepgram connected!');
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';

          if (!mimeType) { resolve(false); return; }

          const rec = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = rec;
          rec.ondataavailable = (e) => {
            if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
          };
          rec.start(250);
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const text = data?.channel?.alternatives?.[0]?.transcript;
            if (!text) return;
            if (data.is_final) {
              finalAccumulatorRef.current += (finalAccumulatorRef.current ? ' ' : '') + text;
              setInterimTranscript(finalAccumulatorRef.current);
            } else {
              setInterimTranscript(
                finalAccumulatorRef.current ? finalAccumulatorRef.current + ' ' + text : text
              );
            }
          } catch { /* */ }
        };

        ws.onclose = (e) => console.log('[VoiceAgent] Deepgram closed:', e.code);

        ws.onerror = () => {
          clearTimeout(timeout);
          console.warn('[VoiceAgent] Deepgram WS error');
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
          }
          resolve(false);
        };
      });
    } catch (err) {
      console.warn('[VoiceAgent] Deepgram setup failed:', err.message);
      return false;
    }
  }, [language]);

  // ─── Web Speech API Fallback ───
  const tryWebSpeechAPI = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = BROWSER_LANG[language] || 'en-IN';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      if (final.trim()) finalAccumulatorRef.current = final.trim();
      setInterimTranscript((final + interim).trim() || '...');
    };

    recognition.onerror = (e) => {
      console.error('[VoiceAgent] Web Speech error:', e.error);
      if (e.error === 'not-allowed') setError('Microphone permission denied.');
    };

    try {
      recognition.start();
      webSpeechRef.current = recognition;
      console.log('[VoiceAgent] Web Speech API started:', recognition.lang);
      return true;
    } catch {
      return false;
    }
  }, [language]);

  // ─── Stop Listening & Process ───
  const stopListening = useCallback(async () => {
    if (webSpeechRef.current) {
      try { webSpeechRef.current.stop(); } catch { /* */ }
      webSpeechRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* */ }
    }
    mediaRecorderRef.current = null;
    if (deepgramSocketRef.current) {
      if (deepgramSocketRef.current.readyState === WebSocket.OPEN) {
        try { deepgramSocketRef.current.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* */ }
      }
      deepgramSocketRef.current.close();
      deepgramSocketRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    const text = finalAccumulatorRef.current.trim();
    setTranscript(text);
    setInterimTranscript('');

    if (text) {
      await processQuery(text);
    } else {
      setStatus('idle');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Process Query (text -> AI -> TTS) ───
  const processQuery = useCallback(async (text) => {
    try {
      setStatus('processing');
      setError(null);

      setMessages((prev) => [...prev.slice(-9), { role: 'user', content: text }]);

      console.log('[VoiceAgent] Processing:', text);
      const result = await processVoiceQuery(text, language);
      console.log('[VoiceAgent] Result:', result);

      const responseText = result?.data?.text || result?.text || '';
      const source = result?.data?.source || result?.source || 'general';

      if (!responseText) throw new Error('Empty response from AI');

      setMessages((prev) => [...prev, { role: 'assistant', content: responseText, source }]);
      await playResponse(responseText);
    } catch (err) {
      console.error('[VoiceAgent] processQuery error:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to get response');
      setStatus('idle');
    }
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Play TTS ───
  const playResponse = useCallback(async (text) => {
    try {
      setStatus('speaking');
      let blob;
      try { blob = await generateTTS(text, language); } catch {
        speakWithBrowser(text);
        return;
      }
      if (!blob || blob.size === 0) { speakWithBrowser(text); return; }

      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(audioUrl); audioRef.current = null; setStatus('idle'); };
      audio.onerror = () => { URL.revokeObjectURL(audioUrl); audioRef.current = null; speakWithBrowser(text); };
      await audio.play();
    } catch {
      setStatus('idle');
    }
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const speakWithBrowser = useCallback((text) => {
    if (!('speechSynthesis' in window)) { setStatus('idle'); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = BROWSER_LANG[language] || 'en-IN';
    utt.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const lc = BROWSER_LANG[language] || 'en-IN';
    const v = voices.find((x) => x.lang === lc) || voices.find((x) => x.lang.startsWith(lc.split('-')[0]));
    if (v) utt.voice = v;
    utt.onend = () => setStatus('idle');
    utt.onerror = () => setStatus('idle');
    setStatus('speaking');
    window.speechSynthesis.speak(utt);
  }, [language]);

  const sendQuickQuery = useCallback(async (queryText) => {
    if (status === 'processing' || status === 'speaking') return;
    setTranscript(queryText);
    await processQuery(queryText);
  }, [status, processQuery]);

  const sendTextQuery = useCallback(async (text) => {
    if (!text?.trim() || status === 'processing' || status === 'speaking') return;
    setTranscript(text.trim());
    await processQuery(text.trim());
  }, [status, processQuery]);

  const stopSpeaking = useCallback(() => {
    cleanupAudio();
    setStatus('idle');
  }, [cleanupAudio]);

  return {
    status, transcript, interimTranscript, messages, error,
    startListening, stopListening, sendQuickQuery, sendTextQuery, stopSpeaking, setMessages,
  };
}
