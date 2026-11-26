'use client';

import { useEffect, useRef, useState } from 'react';
import { request } from '@/lib/api';
import { SpeakButton } from '@/features/a11y/SpeakButton';
import { useSpeech } from '@/features/a11y/useSpeech';
import { Markdown } from './Markdown';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: string[];
  error?: boolean;
};

type AdvisorReply = { reply: string; toolCalls: string[] };

type AdvisorPanelProps = {
  token: string | null;
  username: string | null;
  onLogin: () => void;
  onRegister: () => void;
};

const SUGGESTIONS = [
  'Arma un mazo agresivo rojo con cartas de Final Fantasy',
  '¿Qué cartas de mi colección combinan mejor entre sí?',
  'Explícame cómo armar una buena curva de maná para 60 cartas',
];

const TOOL_LABELS: Record<string, string> = {
  search_cards: 'buscó cartas',
  get_card: 'revisó cartas',
  get_my_collection: 'revisó tu colección',
};

/** Resume las consultas del asesor: «buscó cartas (2), revisó tu colección». */
function describeTools(toolCalls: string[]): string {
  const counts = new Map<string, number>();
  for (const name of toolCalls) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(
      ([name, count]) =>
        `${TOOL_LABELS[name] ?? name}${count > 1 ? ` (${count})` : ''}`,
    )
    .join(', ');
}

function loadMessages(storageKey: string | null): ChatMessage[] {
  if (!storageKey || typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Unauthorized')
    return 'Tu sesión expiró. Vuelve a iniciar sesión para usar el asesor.';
  return message || 'No se pudo consultar al asesor. Intenta de nuevo.';
}

export function AdvisorPanel({
  token,
  username,
  onLogin,
  onRegister,
}: AdvisorPanelProps) {
  const storageKey = username ? `advisor_chat_${username}` : null;
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadMessages(storageKey),
  );
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const speech = useSpeech();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(messages.slice(-40)),
      );
    } catch {
      // Sin almacenamiento (modo privado): la conversación dura solo la sesión.
    }
  }, [messages, storageKey]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending || !token) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };
    const history = [...messages.filter((m) => !m.error), userMessage];
    setMessages((previous) => [...previous, userMessage]);
    setInput('');
    setPending(true);

    try {
      const result = await request<AdvisorReply>(
        '/advisor/chat',
        {
          method: 'POST',
          body: JSON.stringify({
            language: 'es',
            messages: history
              .slice(-20)
              .map(({ role, content: body }) => ({ role, content: body })),
          }),
        },
        token,
      );
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.reply,
          toolCalls: result.toolCalls,
        },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: friendlyError(error),
          error: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function newConversation() {
    speech.stop();
    setMessages([]);
  }

  return (
    <section className="advisor-section" aria-labelledby="advisor-title">
      <div className="advisor-header">
        <div>
          <h2 className="section-title" id="advisor-title">
            Asesor de mazos IA
          </h2>
          <p className="section-subtitle">
            Pregunta cómo armar un mazo o qué estrategia usar. Recomienda solo
            cartas reales del catálogo y puede revisar tu colección.
          </p>
        </div>
        {token && messages.length > 0 && (
          <button
            className="btn btn-outline btn-sm"
            onClick={newConversation}
            type="button"
          >
            Nueva conversación
          </button>
        )}
      </div>

      {!token ? (
        <div className="collection-auth-warning">
          <h3>Inicia sesión o crea una cuenta para usar el asesor</h3>
          <p>
            El asesor usa tu colección para recomendarte cartas y estrategias.
          </p>
          <div className="auth-warning-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={onLogin}
              type="button"
            >
              Iniciar Sesión
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={onRegister}
              type="button"
            >
              Crear cuenta
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="advisor-log"
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-label="Conversación con el asesor"
          >
            {messages.length === 0 && (
              <div className="advisor-empty">
                <p>Prueba con una de estas preguntas:</p>
                <div className="advisor-suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      className="advisor-chip"
                      key={suggestion}
                      onClick={() => void send(suggestion)}
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <article
                className={`advisor-msg ${message.role}${message.error ? ' error' : ''}`}
                key={message.id}
              >
                <span className="advisor-role">
                  {message.role === 'user' ? 'Tú' : 'Asesor'}
                </span>
                {message.role === 'assistant' && !message.error ? (
                  <Markdown text={message.content} />
                ) : (
                  <p>{message.content}</p>
                )}
                {message.role === 'assistant' && !message.error && (
                  <div className="advisor-msg-footer">
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <span className="advisor-tools">
                        Consultó la base: {describeTools(message.toolCalls)}
                      </span>
                    )}
                    <SpeakButton
                      id={message.id}
                      segments={[{ text: message.content, lang: 'es' }]}
                      speech={speech}
                    />
                  </div>
                )}
              </article>
            ))}

            {pending && (
              <div className="advisor-msg assistant pending" aria-busy="true">
                <span className="advisor-role">Asesor</span>
                <p>Consultando el catálogo…</p>
              </div>
            )}
          </div>

          <form
            className="advisor-form"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <label className="sr-only" htmlFor="advisor-input">
              Escribe tu pregunta para el asesor
            </label>
            <textarea
              className="search-input form-input advisor-input"
              id="advisor-input"
              rows={2}
              maxLength={2000}
              value={input}
              disabled={pending}
              placeholder="Ej.: arma un mazo verde de 60 cartas con criaturas grandes"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
            />
            <button
              className="btn btn-primary"
              disabled={pending || !input.trim()}
              type="submit"
            >
              {pending ? 'Pensando…' : 'Enviar'}
            </button>
          </form>
          <p className="advisor-note">
            Las respuestas las genera una IA (Groq) y pueden tener errores. Para
            responder, tus mensajes y tu colección se envían a Groq.
          </p>
        </>
      )}
    </section>
  );
}
