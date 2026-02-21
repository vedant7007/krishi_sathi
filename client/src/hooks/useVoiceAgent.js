import { useState, useRef, useCallback, useEffect } from 'react';
import { processVoiceQuery, generateTTS, getSTTToken } from '../services/agentApi';

const DEEPGRAM_LANG = { en: 'en', hi: 'hi', te: 'te' };
const BROWSER_LANG = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' };

// How long to wait after last speech before auto-processing (ms)
const SILENCE_TIMEOUT = 1500;
// Max time to stay in listening state before forcing a process (ms)
const MAX_LISTEN_TIME = 15000;

export default function useVoiceAgent(language = 'en') {
  const [status, setStatus] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [isActive, setIsActive] = useState(false);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const deepgramSocketRef = useRef(null);
  const audioRef = useRef(null);
  const finalAccumulatorRef = useRef('');
  const webSpeechRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const safetyTimerRef = useRef(null);
  const isActiveRef = useRef(false);
  const statusRef = useRef('idle');
  const messagesRef = useRef([]);
  const languageRef = useRef(language);

  // ─── Refs for functions so callbacks always get the latest version ───
  const doStopAndProcessRef = useRef(null);
  const beginListeningRef = useRef(null);
  const processQueryRef = useRef(null);
  const playResponseRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { languageRef.current = language; }, [language]);

  useEffect(() => {
    return () => {
      cleanupSTT();
      cleanupAudio();
      clearTimeout(silenceTimerRef.current);
      clearTimeout(safetyTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanupSTT = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    clearTimeout(safetyTimerRef.current);
    if (webSpeechRef.current) {
      try { webSpeechRef.current.abort(); } catch (e) { console.warn('[VoiceAgent] Web Speech abort:', e.message); }
      webSpeechRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) { console.warn('[VoiceAgent] MediaRecorder stop:', e.message); }
    }
    mediaRecorderRef.current = null;
    if (deepgramSocketRef.current) {
      if (deepgramSocketRef.current.readyState === WebSocket.OPEN) {
        try { deepgramSocketRef.current.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* */ }
      }
      try { deepgramSocketRef.current.close(); } catch { /* */ }
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

  // ─── Auto-silence: after speech stops, auto-process ───
  const resetSilenceTimer = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      const text = finalAccumulatorRef.current.trim();
      if (text && statusRef.current === 'listening') {
        console.log('[VoiceAgent] Silence timer fired, auto-processing:', text);
        doStopAndProcessRef.current?.();
      }
    }, SILENCE_TIMEOUT);
  }, []);

  // Safety timer — max time in listening state
  const startSafetyTimer = useCallback(() => {
    clearTimeout(safetyTimerRef.current);
    safetyTimerRef.current = setTimeout(() => {
      const text = finalAccumulatorRef.current.trim();
      if (statusRef.current === 'listening' && text) {
        console.log('[VoiceAgent] Safety timer fired (max listen time), auto-processing:', text);
        doStopAndProcessRef.current?.();
      }
    }, MAX_LISTEN_TIME);
  }, []);

  // ─── Start Listening ───
  const beginListening = useCallback(async () => {
    try {
      setError(null);
      cleanupSTT();
      finalAccumulatorRef.current = '';
      setInterimTranscript('');
      setTranscript('');

      const deepgramOk = await tryDeepgramSTT();
      if (deepgramOk) {
        setStatus('listening');
        startSafetyTimer();
        if (navigator.vibrate) navigator.vibrate(50);
        return true;
      }

      console.log('[VoiceAgent] Deepgram unavailable, trying Web Speech API...');
      const webOk = tryWebSpeechAPI();
      if (webOk) {
        setStatus('listening');
        startSafetyTimer();
        if (navigator.vibrate) navigator.vibrate(50);
        return true;
      }

      setError('Speech recognition unavailable. Please type your question.');
      setStatus('idle');
      return false;
    } catch (err) {
      console.error('[VoiceAgent] startListening error:', err);
      cleanupSTT();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied.');
      } else {
        setError(err.message || 'Failed to start listening.');
      }
      setStatus('idle');
      return false;
    }
  }, [language, cleanupSTT, startSafetyTimer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Deepgram WebSocket STT ───
  const tryDeepgramSTT = useCallback(async () => {
    try {
      const tokenData = await getSTTToken();
      const apiKey = tokenData?.data?.key || tokenData?.key || tokenData?.token || tokenData?.data?.token;
      if (!apiKey) {
        console.log('[VoiceAgent] No Deepgram API key available');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const dgLang = DEEPGRAM_LANG[language] || 'en';
      const wsUrl = `wss://api.deepgram.com/v1/listen?language=${dgLang}&model=nova-2&smart_format=true&interim_results=true&endpointing=400&utterance_end_ms=${SILENCE_TIMEOUT}`;

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('[VoiceAgent] Deepgram WebSocket timeout');
          resolve(false);
        }, 5000);

        const ws = new WebSocket(wsUrl, ['token', apiKey]);
        deepgramSocketRef.current = ws;

        ws.onopen = () => {
          clearTimeout(timeout);
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';

          if (!mimeType) {
            console.log('[VoiceAgent] No supported audio MIME type');
            resolve(false);
            return;
          }

          const rec = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = rec;
          rec.ondataavailable = (e) => {
            if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
          };
          rec.start(250);
          console.log('[VoiceAgent] Deepgram STT connected');
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Deepgram UtteranceEnd — auto-stop and process
            if (data.type === 'UtteranceEnd') {
              const text = finalAccumulatorRef.current.trim();
              if (text && statusRef.current === 'listening') {
                console.log('[VoiceAgent] UtteranceEnd, auto-processing:', text);
                // Defer to avoid closing WebSocket inside its own handler
                setTimeout(() => doStopAndProcessRef.current?.(), 0);
              }
              return;
            }

            const text = data?.channel?.alternatives?.[0]?.transcript;
            if (!text) return;

            if (data.is_final) {
              finalAccumulatorRef.current += (finalAccumulatorRef.current ? ' ' : '') + text;
              setInterimTranscript(finalAccumulatorRef.current);
              resetSilenceTimer();
            } else {
              setInterimTranscript(
                finalAccumulatorRef.current ? finalAccumulatorRef.current + ' ' + text : text
              );
            }
          } catch (err) {
            console.warn('[VoiceAgent] Deepgram message parse error:', err.message);
          }
        };

        ws.onclose = (event) => {
          console.log('[VoiceAgent] Deepgram WS closed:', event.code, event.reason);
        };
        ws.onerror = (err) => {
          console.warn('[VoiceAgent] Deepgram WS error:', err);
          clearTimeout(timeout);
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
          }
          resolve(false);
        };
      });
    } catch (err) {
      console.warn('[VoiceAgent] tryDeepgramSTT exception:', err.message);
      return false;
    }
  }, [language, resetSilenceTimer]);

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
      let finalText = '';
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + ' ';
        else interim += t;
      }
      if (finalText.trim()) {
        finalAccumulatorRef.current = finalText.trim();
        resetSilenceTimer();
      }
      const display = (finalText + interim).trim() || '...';
      setInterimTranscript(display);

      // If we have interim text but no finals, start a longer timer
      // so we don't hang forever waiting for isFinal
      if (!finalText.trim() && interim.trim() && !finalAccumulatorRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          // Use interim as final if nothing else came
          if (!finalAccumulatorRef.current && statusRef.current === 'listening') {
            finalAccumulatorRef.current = interim.trim();
            console.log('[VoiceAgent] Using interim text as final:', interim.trim());
            doStopAndProcessRef.current?.();
          }
        }, SILENCE_TIMEOUT + 500);
      }
    };

    recognition.onerror = (e) => {
      console.warn('[VoiceAgent] Web Speech error:', e.error);
      if (e.error === 'not-allowed') setError('Microphone permission denied.');
    };

    // Web Speech sometimes auto-ends — treat as silence
    recognition.onend = () => {
      console.log('[VoiceAgent] Web Speech onend fired');
      const text = finalAccumulatorRef.current.trim();
      if (text && statusRef.current === 'listening') {
        doStopAndProcessRef.current?.();
      } else if (statusRef.current === 'listening' && isActiveRef.current) {
        // Web Speech ended without text — try restarting
        console.log('[VoiceAgent] Web Speech ended without text, restarting...');
        try { recognition.start(); } catch { /* */ }
      }
    };

    try {
      recognition.start();
      webSpeechRef.current = recognition;
      console.log('[VoiceAgent] Web Speech API started');
      return true;
    } catch (err) {
      console.warn('[VoiceAgent] Web Speech start failed:', err.message);
      return false;
    }
  }, [language, resetSilenceTimer]);

  // ─── Stop Listening & Process ───
  const doStopAndProcess = useCallback(async () => {
    // Prevent double-processing
    if (statusRef.current === 'processing' || statusRef.current === 'speaking') {
      console.log('[VoiceAgent] Already processing/speaking, skipping doStopAndProcess');
      return;
    }

    clearTimeout(silenceTimerRef.current);
    clearTimeout(safetyTimerRef.current);
    cleanupSTT();

    const text = finalAccumulatorRef.current.trim();
    finalAccumulatorRef.current = ''; // Reset to prevent double-processing
    setTranscript(text);
    setInterimTranscript('');

    if (text) {
      console.log('[VoiceAgent] Processing captured text:', text);
      await processQueryRef.current?.(text);
    } else {
      // No text captured — if conversation active, restart listening
      if (isActiveRef.current) {
        setStatus('listening');
        beginListeningRef.current?.();
      } else {
        setStatus('idle');
      }
    }
  }, [cleanupSTT]);

  // ─── Process Query (text -> AI -> TTS) ───
  const processQuery = useCallback(async (text) => {
    try {
      setStatus('processing');
      setError(null);

      const history = messagesRef.current.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev.slice(-9), { role: 'user', content: text }]);

      const lang = languageRef.current;
      console.log('[VoiceAgent] Processing:', text, `(${history.length} history, lang=${lang})`);
      const result = await processVoiceQuery(text, lang, history);

      const responseText = result?.data?.text || result?.text || '';
      const source = result?.data?.source || result?.source || 'general';

      if (!responseText) throw new Error('Empty response from AI');

      setMessages((prev) => [...prev, { role: 'assistant', content: responseText, source }]);
      await playResponseRef.current?.(responseText);
    } catch (err) {
      console.error('[VoiceAgent] processQuery error:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to get response');
      if (isActiveRef.current) {
        setStatus('listening');
        setTimeout(() => beginListeningRef.current?.(), 500);
      } else {
        setStatus('idle');
      }
    }
  }, []); // No deps — uses refs for everything dynamic

  // ─── Play TTS, then auto-listen again ───
  const playResponse = useCallback(async (text) => {
    try {
      setStatus('speaking');

      const onDoneSpeaking = () => {
        if (isActiveRef.current) {
          console.log('[VoiceAgent] Done speaking, auto-resuming listening');
          beginListeningRef.current?.();
        } else {
          setStatus('idle');
        }
      };

      const lang = languageRef.current;
      let blob;
      try { blob = await generateTTS(text, lang); } catch (e) {
        console.warn('[VoiceAgent] TTS fetch failed:', e.message);
      }

      if (!blob || blob.size === 0) {
        speakWithBrowser(text, onDoneSpeaking);
        return;
      }

      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        onDoneSpeaking();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        speakWithBrowser(text, onDoneSpeaking);
      };

      await audio.play();
    } catch (err) {
      console.warn('[VoiceAgent] playResponse error:', err.message);
      if (isActiveRef.current) {
        beginListeningRef.current?.();
      } else {
        setStatus('idle');
      }
    }
  }, []); // No deps — uses refs

  const speakWithBrowser = useCallback((text, onDone) => {
    if (!('speechSynthesis' in window)) { onDone?.(); setStatus('idle'); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const lang = languageRef.current;
    utt.lang = BROWSER_LANG[lang] || 'en-IN';
    utt.rate = 0.95;
    utt.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const lc = BROWSER_LANG[lang] || 'en-IN';
    const v = voices.find((x) => x?.lang === lc && (x.name?.includes('Microsoft') || x.name?.includes('Google')))
      || voices.find((x) => x?.lang === lc)
      || voices.find((x) => x?.lang?.startsWith(lc.split('-')[0]));
    if (v) utt.voice = v;
    utt.onend = () => { onDone?.(); };
    utt.onerror = () => { onDone?.(); };
    setStatus('speaking');
    window.speechSynthesis.speak(utt);
  }, []);

  // ─── Keep function refs updated ───
  useEffect(() => { doStopAndProcessRef.current = doStopAndProcess; }, [doStopAndProcess]);
  useEffect(() => { beginListeningRef.current = beginListening; }, [beginListening]);
  useEffect(() => { processQueryRef.current = processQuery; }, [processQuery]);
  useEffect(() => { playResponseRef.current = playResponse; }, [playResponse]);

  // ─── Public API ───

  const toggleConversation = useCallback(async () => {
    if (isActiveRef.current) {
      console.log('[VoiceAgent] Stopping conversation');
      setIsActive(false);
      isActiveRef.current = false;
      cleanupSTT();
      cleanupAudio();
      clearTimeout(silenceTimerRef.current);
      clearTimeout(safetyTimerRef.current);
      setStatus('idle');
    } else {
      console.log('[VoiceAgent] Starting conversation');
      setIsActive(true);
      isActiveRef.current = true;
      const ok = await beginListening();
      if (!ok) {
        setIsActive(false);
        isActiveRef.current = false;
      }
    }
  }, [beginListening, cleanupSTT, cleanupAudio]);

  const startListening = useCallback(async () => {
    setIsActive(true);
    isActiveRef.current = true;
    await beginListening();
  }, [beginListening]);

  const stopListening = useCallback(async () => {
    await doStopAndProcess();
  }, [doStopAndProcess]);

  const sendQuickQuery = useCallback(async (queryText) => {
    if (statusRef.current === 'processing' || statusRef.current === 'speaking') return;
    setIsActive(true);
    isActiveRef.current = true;
    setTranscript(queryText);
    await processQuery(queryText);
  }, [processQuery]);

  const sendTextQuery = useCallback(async (text) => {
    if (!text?.trim() || statusRef.current === 'processing' || statusRef.current === 'speaking') return;
    setIsActive(true);
    isActiveRef.current = true;
    setTranscript(text.trim());
    await processQuery(text.trim());
  }, [processQuery]);

  const stopSpeaking = useCallback(() => {
    cleanupAudio();
    if (isActiveRef.current) {
      beginListening();
    } else {
      setStatus('idle');
    }
  }, [cleanupAudio, beginListening]);

  const endConversation = useCallback(() => {
    setIsActive(false);
    isActiveRef.current = false;
    cleanupSTT();
    cleanupAudio();
    clearTimeout(silenceTimerRef.current);
    clearTimeout(safetyTimerRef.current);
    setStatus('idle');
  }, [cleanupSTT, cleanupAudio]);

  return {
    status, transcript, interimTranscript, messages, error, isActive,
    startListening, stopListening, toggleConversation, endConversation,
    sendQuickQuery, sendTextQuery, stopSpeaking, setMessages,
  };
}
