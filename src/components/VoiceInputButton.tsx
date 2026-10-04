import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useToast } from './Toast';

type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechErrorEvent = { error?: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function VoiceInputButton({ onTranscript, disabled }: {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const toast = useToast((s) => s.show);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const browser = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Recognition) {
      toast('Voice typing is not available in this browser. Try Chrome or Edge.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' ').trim();
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') toast('Microphone access was denied. Allow it in your browser settings and try again.');
      else if (event.error === 'audio-capture') toast('No microphone was found. Check your device and try again.');
      else if (event.error !== 'aborted' && event.error !== 'no-speech') toast('Voice typing stopped. Please try again.');
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      toast('Could not start voice typing. Try again in a moment.');
    }
  }

  return (
    <button
      type="button"
      className={`mic ${listening ? 'listening' : ''}`}
      aria-label={listening ? 'Stop voice typing' : 'Start voice typing'}
      aria-pressed={listening}
      title={listening ? 'Stop voice typing' : 'Voice type'}
      disabled={disabled}
      onClick={toggle}
    >
      <Icon name={listening ? 'stop' : 'mic'} />
    </button>
  );
}
