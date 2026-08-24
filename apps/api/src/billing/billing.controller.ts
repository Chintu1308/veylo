import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import {
  CreateSubscriptionSchema,
  SimulatedPaymentSchema,
  CreateSubscriptionRequest,
  SimulatedPaymentRequest,
} from '@veylo/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BillingService } from './billing.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../projects/projects.controller';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { JwtPayload } from '../auth/supabase-jwt.strategy';

@Controller('projects/:projectId/billing')
@UseGuards(AuthGuard('supabase-jwt'), RolesGuard)
export class BillingController {
  constructor(
    @Inject(BillingService)
    private readonly billingService: BillingService,
    @Inject(AuditLogsService)
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Get('plans')
  async getPlans() {
    return this.billingService.listPlans();
  }

  @Get('subscription')
  async getSubscription(@Param('projectId') projectId: string) {
    return this.billingService.getSubscription(projectId);
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @Roles('project_admin')
  async subscribe(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(CreateSubscriptionSchema))
    body: CreateSubscriptionRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const subscription = await this.billingService.createSubscription(projectId, body.plan_id);

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'billing.subscribe_initiated',
      targetType: 'subscription',
      targetId: subscription.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: { plan_id: body.plan_id },
    });

    return subscription;
  }

  @Post('pay')
  @HttpCode(HttpStatus.OK)
  @Roles('project_admin')
  async pay(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(SimulatedPaymentSchema))
    body: SimulatedPaymentRequest,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const payment = await this.billingService.processSimulatedPayment(
      projectId,
      body.subscription_id,
      body.card_token,
    );

    await this.auditLogsService.logAction({
      projectId: projectId,
      actorId: user.sub,
      actorEmail: user.email,
      action: 'billing.payment_succeeded',
      targetType: 'payment',
      targetId: payment.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: { amount_cents: payment.amount_cents, transaction_id: payment.transaction_id },
    });

    return payment;
  }
}
