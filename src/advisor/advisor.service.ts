import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Groq, {
  APIConnectionError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from 'groq-sdk';
import { buildSystemPrompt } from './advisor.prompt.js';
import { ADVISOR_TOOLS, AdvisorTools } from './advisor.tools.js';
import {
  DEFAULT_GROQ_MODEL,
  GROQ_CLIENT,
  type AdvisorLlmClient,
} from './advisor.constants.js';
import { AdvisorChatDto } from './dto/advisor-chat.dto.js';

type ChatMessage = Groq.Chat.Completions.ChatCompletionMessageParam;
type AssistantMessage = Groq.Chat.Completions.ChatCompletionMessage;

export type AdvisorReply = {
  reply: string;
  toolCalls: string[];
  model: string;
  usage: { promptTokens: number; completionTokens: number };
};

/** Rondas de herramientas antes de pedir la respuesta final sin ellas. */
const MAX_TOOL_ROUNDS = 6;
/** Mensajes del historial que se reenvían al modelo. */
const MAX_HISTORY = 12;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const UNAVAILABLE = 'El asesor IA no está disponible en este momento.';

@Injectable()
export class AdvisorService {
  private readonly logger = new Logger(AdvisorService.name);
  /** Límite por usuario en memoria de la instancia (mejor esfuerzo en serverless). */
  private readonly recentRequests = new Map<string, number[]>();

  constructor(
    private readonly tools: AdvisorTools,
    @Inject(GROQ_CLIENT) private readonly client: AdvisorLlmClient | null,
  ) {}

  async chat(userId: string, dto: AdvisorChatDto): Promise<AdvisorReply> {
    if (process.env.ADVISOR_ENABLED === 'false' || !this.client) {
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
    if (dto.messages.at(-1)?.role !== 'user') {
      throw new BadRequestException('El último mensaje debe ser del usuario');
    }
    this.checkRateLimit(userId);

    const model = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(dto.language ?? 'es') },
      ...dto.messages
        .slice(-MAX_HISTORY)
        .map((m): ChatMessage => ({ role: m.role, content: m.content })),
    ];
    const toolCalls: string[] = [];
    const usage = { promptTokens: 0, completionTokens: 0 };

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const message = await this.complete(
        this.client,
        model,
        messages,
        usage,
        true,
      );
      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        return this.toReply(message, toolCalls, model, usage);
      }

      messages.push({
        role: 'assistant',
        content: message.content ?? '',
        tool_calls: calls,
      });
      for (const call of calls) {
        const result = await this.tools.run(
          call.function.name,
          call.function.arguments,
          userId,
        );
        toolCalls.push(call.function.name);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Demasiadas rondas de herramientas: pide la respuesta final sin ellas.
    const final = await this.complete(
      this.client,
      model,
      messages,
      usage,
      false,
    );
    return this.toReply(final, toolCalls, model, usage);
  }

  private async complete(
    client: AdvisorLlmClient,
    model: string,
    messages: ChatMessage[],
    usage: AdvisorReply['usage'],
    withTools: boolean,
  ): Promise<AssistantMessage> {
    for (let attempt = 0; ; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages,
          temperature: 0.4,
          max_completion_tokens: 2048,
          ...(withTools
            ? { tools: ADVISOR_TOOLS, tool_choice: 'auto' as const }
            : { tool_choice: 'none' as const }),
        });
        usage.promptTokens += completion.usage?.prompt_tokens ?? 0;
        usage.completionTokens += completion.usage?.completion_tokens ?? 0;

        const message = completion.choices[0]?.message;
        if (!message) throw new ServiceUnavailableException(UNAVAILABLE);
        return message;
      } catch (error) {
        // Groq responde 400 si el modelo genera una llamada de herramienta mal
        // formada (tool_use_failed): se reintenta una vez.
        if (attempt === 0 && error instanceof BadRequestError) {
          this.logger.warn(`Groq 400, reintentando: ${error.message}`);
          continue;
        }
        throw this.toHttpError(error);
      }
    }
  }

  private toReply(
    message: AssistantMessage,
    toolCalls: string[],
    model: string,
    usage: AdvisorReply['usage'],
  ): AdvisorReply {
    const reply = (message.content ?? '').trim();
    return {
      reply:
        reply ||
        'No pude generar una respuesta. ¿Puedes reformular la pregunta?',
      toolCalls,
      model,
      usage,
    };
  }

  private toHttpError(error: unknown): HttpException {
    if (error instanceof HttpException) return error;
    if (error instanceof RateLimitError) {
      return new HttpException(
        'El asesor está recibiendo muchas consultas. Intenta de nuevo en un minuto.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (
      error instanceof AuthenticationError ||
      error instanceof PermissionDeniedError
    ) {
      this.logger.error('Groq rechazó la clave: revisa GROQ_API_KEY');
    } else if (error instanceof APIConnectionError) {
      this.logger.error(`No se pudo conectar con Groq: ${error.message}`);
    } else {
      this.logger.error('Error inesperado del asesor', error as Error);
    }
    return new ServiceUnavailableException(UNAVAILABLE);
  }

  private checkRateLimit(userId: string): void {
    const max = Number(process.env.ADVISOR_MAX_REQUESTS_PER_10_MIN ?? 20);
    const now = Date.now();
    const recent = (this.recentRequests.get(userId) ?? []).filter(
      (time) => now - time < RATE_WINDOW_MS,
    );
    if (recent.length >= max) {
      throw new HttpException(
        'Hiciste muchas consultas al asesor. Espera unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.recentRequests.set(userId, recent);
  }
}
