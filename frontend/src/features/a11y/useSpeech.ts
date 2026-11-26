'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

export type SpeechLang = 'es' | 'en';
/** Un tramo de texto con su idioma: el texto de las cartas está en inglés. */
export type SpeechSegment = { text: string; lang: SpeechLang };

const VOICE_LANG: Record<SpeechLang, string> = { es: 'es-ES', en: 'en-US' };
const MANA_WORDS: Record<SpeechLang, Record<string, string>> = {
  es: {
    W: 'blanco',
    U: 'azul',
    B: 'negro',
    R: 'rojo',
    G: 'verde',
    C: 'incoloro',
    T: 'girar',
    X: 'equis',
  },
  en: {
    W: 'white',
    U: 'blue',
    B: 'black',
    R: 'red',
    G: 'green',
    C: 'colorless',
    T: 'tap',
    X: 'X',
  },
};

function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

const subscribeNoop = () => () => {};

/** Quita Markdown y convierte símbolos como {2}{R} en palabras pronunciables. */
export function toSpeakableText(text: string, lang: SpeechLang): string {
  const words = MANA_WORDS[lang];
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)[*_]([^*_\n]+)[*_]/g, '$1$2')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\{(\d+)\}/g, ' $1, ')
    .replace(
      /\{([A-Z])\}/g,
      (_, symbol: string) => ` ${words[symbol] ?? symbol}, `,
    )
    .replace(/\|/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Algunos navegadores cortan locuciones largas: se divide en trozos cortos. */
function chunk(text: string, max = 220): string[] {
  const sentences = text.match(/[^.!?¡¿\n]+[.!?]*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;
    if ((current + ' ' + piece).length > max && current) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Lector de voz con la Web Speech API del navegador: sin servidor ni costo.
 * `speakingId` dice qué elemento se está leyendo, para el estado del botón.
 */
export function useSpeech() {
  const supported = useSyncExternalStore(
    subscribeNoop,
    isSupported,
    () => false,
  );
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (isSupported()) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback((id: string, segments: SpeechSegment[]) => {
    if (!isSupported()) return;
    const synth = window.speechSynthesis;
    synth.cancel();

    const voices = synth.getVoices();
    const utterances = segments.flatMap(({ text, lang }) => {
      const voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang));
      return chunk(toSpeakableText(text, lang)).map((piece) => {
        const utterance = new SpeechSynthesisUtterance(piece);
        utterance.lang = VOICE_LANG[lang];
        if (voice) utterance.voice = voice;
        return utterance;
      });
    });
    if (utterances.length === 0) return;

    const last = utterances.at(-1);
    if (last)
      last.onend = () =>
        setSpeakingId((current) => (current === id ? null : current));
    for (const utterance of utterances) {
      utterance.onerror = () =>
        setSpeakingId((current) => (current === id ? null : current));
      synth.speak(utterance);
    }
    setSpeakingId(id);
  }, []);

  // Al desmontar, no dejar al navegador hablando solo.
  useEffect(
    () => () => {
      if (isSupported()) window.speechSynthesis.cancel();
    },
    [],
  );

  return { supported, speakingId, speak, stop };
}

export type SpeechController = ReturnType<typeof useSpeech>;
