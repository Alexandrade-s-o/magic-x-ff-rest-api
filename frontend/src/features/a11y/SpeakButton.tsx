'use client';

import type { SpeechController, SpeechSegment } from './useSpeech';

type SpeakButtonProps = {
  id: string;
  segments: SpeechSegment[];
  speech: SpeechController;
  label?: string;
};

/** Botón «Escuchar / Detener». No se muestra si el navegador no tiene voz. */
export function SpeakButton({
  id,
  segments,
  speech,
  label = 'Escuchar',
}: SpeakButtonProps) {
  if (!speech.supported) return null;
  const active = speech.speakingId === id;

  return (
    <button
      className="btn btn-outline btn-sm speak-btn"
      type="button"
      aria-pressed={active}
      onClick={() => (active ? speech.stop() : speech.speak(id, segments))}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
        {active ? (
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        ) : (
          <path
            d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"
            fill="currentColor"
          />
        )}
      </svg>
      {active ? 'Detener' : label}
    </button>
  );
}
