import { jest } from '@jest/globals';
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { RateLimitError } from 'groq-sdk';
import type { AdvisorLlmClient } from './advisor.constants.js';
import { AdvisorService } from './advisor.service.js';
import type { AdvisorTools } from './advisor.tools.js';

type Completion = {
  choices: { message: Record<string, unknown> }[];
  usage?: Record<string, number>;
};

function setup(responses: (Completion | Error)[]) {
  const create = jest.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('no more fake responses');
    if (next instanceof Error) throw next;
    return next;
  });
  const client = {
    chat: { completions: { create } },
  } as unknown as AdvisorLlmClient;
  const run = jest.fn(async () => ({
    found: 1,
    cards: [{ id: 7, name: 'Fast Goblin' }],
  }));
  const tools = { run } as unknown as AdvisorTools;
  return { service: new AdvisorService(tools, client), create, run };
}

const ask = {
  messages: [{ role: 'user' as const, content: 'Arma un mazo rojo' }],
};

describe('AdvisorService.chat', () => {
  it('runs the requested tools and returns the final answer', async () => {
    const { service, create, run } = setup([
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'search_cards',
                    arguments: '{"colors":["R"]}',
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 10 },
      },
      {
        choices: [
          { message: { role: 'assistant', content: 'Usa **Fast Goblin**.' } },
        ],
        usage: { prompt_tokens: 150, completion_tokens: 20 },
      },
    ]);

    const result = await service.chat('user-1', ask);

    expect(run).toHaveBeenCalledWith(
      'search_cards',
      '{"colors":["R"]}',
      'user-1',
    );
    expect(result).toEqual({
      reply: 'Usa **Fast Goblin**.',
      toolCalls: ['search_cards'],
      model: expect.any(String),
      usage: { promptTokens: 250, completionTokens: 30 },
    });

    const secondCall = create.mock.calls[1] as unknown as [
      { messages: { role: string }[] },
    ];
    expect(secondCall[0].messages.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'tool',
    ]);
  });

  it('rejects a conversation that does not end with the user', async () => {
    const { service } = setup([]);
    await expect(
      service.chat('user-1', {
        messages: [{ role: 'assistant', content: 'Hola' }],
      }),
    ).rejects.toThrow('El último mensaje debe ser del usuario');
  });

  it('answers 503 when no Groq key is configured', async () => {
    const tools = { run: jest.fn() } as unknown as AdvisorTools;
    const service = new AdvisorService(tools, null);
    await expect(service.chat('user-1', ask)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('turns a Groq rate limit into a 429', async () => {
    const { service } = setup([
      new RateLimitError(429, undefined, 'rate limited', new Headers()),
    ]);
    const error = await service.chat('user-1', ask).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
  });
});
