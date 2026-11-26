'use client';

import { useEffect, useRef, useState } from 'react';
import { request } from '@/lib/api';
import { SpeakButton } from '@/features/a11y/SpeakButton';
import { useSpeech } from '@/features/a11y/useSpeech';
import { useI18n } from '@/features/i18n/I18nProvider';
import { errorText } from '@/features/i18n/errors';
import { format, type Dictionary } from '@/i18n';
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

/** Resume las consultas del asesor: «buscó cartas (2), revisó tu colección». */
function describeTools(toolCalls: string[], dict: Dictionary): string {
  const labels: Record<string, string> = {
    search_cards: dict.advisor.toolSearch,
    get_card: dict.advisor.toolCard,
    get_my_collection: dict.advisor.toolCollection,
  };
  const counts = new Map<string, number>();
  for (const name of toolCalls) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(
      ([name, count]) =>
        `${labels[name] ?? name}${count > 1 ? ` (${count})` : ''}`,
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

export function AdvisorPanel({
  token,
  username,
  onLogin,
  onRegister,
}: AdvisorPanelProps) {
  const { lang, dict } = useI18n();
  const t = dict.advisor;
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
            language: lang,
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
          content: errorText(error, dict, { 401: t.sessionExpired }),
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
            {t.title}
          </h2>
          <p className="section-subtitle">{t.subtitle}</p>
        </div>
        {token && messages.length > 0 && (
          <button
            className="btn btn-outline btn-sm"
            onClick={newConversation}
            type="button"
          >
            {t.newConversation}
          </button>
        )}
      </div>

      {!token ? (
        <div className="collection-auth-warning">
          <h3>{t.authTitle}</h3>
          <p>{t.authText}</p>
          <div className="auth-warning-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={onLogin}
              type="button"
            >
              {t.login}
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={onRegister}
              type="button"
            >
              {t.register}
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
            aria-label={t.logLabel}
          >
            {messages.length === 0 && (
              <div className="advisor-empty">
                <p>{t.tryThese}</p>
                <div className="advisor-suggestions">
                  {t.suggestions.map((suggestion) => (
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
                  {message.role === 'user' ? t.you : t.assistant}
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
                        {format(t.consulted, {
                          tools: describeTools(message.toolCalls, dict),
                        })}
                      </span>
                    )}
                    <SpeakButton
                      id={message.id}
                      segments={[{ text: message.content, lang }]}
                      speech={speech}
                    />
                  </div>
                )}
              </article>
            ))}

            {pending && (
              <div className="advisor-msg assistant pending" aria-busy="true">
                <span className="advisor-role">{t.assistant}</span>
                <p>{t.thinking}</p>
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
              {t.inputLabel}
            </label>
            <textarea
              className="search-input form-input advisor-input"
              id="advisor-input"
              rows={2}
              maxLength={2000}
              value={input}
              disabled={pending}
              placeholder={t.placeholder}
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
              {pending ? t.sending : t.send}
            </button>
          </form>
          <p className="advisor-note">{t.note}</p>
        </>
      )}
    </section>
  );
}
