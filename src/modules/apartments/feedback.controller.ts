import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { ApartmentService } from './apartments.service';
import { SubmitFeedbackDto } from './apartments.dto';
import { Request } from 'express';

@Controller('feedback')
@ApiTags('feedback')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FeedbackController {
  constructor(private readonly apartmentService: ApartmentService) {}

  @Post()
  @ApiOperation({
    summary: 'Submit feedback',
    description: 'Allows an authenticated user to submit feedback for the platform.',
  })
  @ApiCreatedResponse({ description: 'Feedback submitted', schema: { type: 'object' } })
  submitFeedback(@Body() body: SubmitFeedbackDto, @Req() req: Request) {
    return this.apartmentService.submitFeedback(body, req.user as any);
  }
}
