import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdvisorService } from './advisor.service.js';
import { AdvisorChatDto } from './dto/advisor-chat.dto.js';

@Controller('advisor')
@UseGuards(JwtAuthGuard)
export class AdvisorController {
  constructor(private readonly advisor: AdvisorService) {}

  /** Una vuelta de conversación: el asesor puede consultar la base varias veces. */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(
    @Request() request: { user: { id: string } },
    @Body() dto: AdvisorChatDto,
  ) {
    return this.advisor.chat(request.user.id, dto);
  }
}
