import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentGatewayService } from './payment-gateway.service';
import { CreateGatewayConfigDto, UpdateGatewayConfigDto, CreatePaymentLinkDto } from './dto';
import { PaymentGatewayProvider } from '@prisma/client';

interface AuthRequest extends Request {
  user: { businessId: string };
}

@Controller()
export class PaymentGatewayController {
  constructor(private readonly paymentGatewayService: PaymentGatewayService) {}

  // ============== Gateway Config Endpoints ==============

  @Get('payment-gateway/config')
  @UseGuards(JwtAuthGuard)
  async getConfigs(@Req() req: AuthRequest) {
    return this.paymentGatewayService.getConfigs(req.user.businessId);
  }

  @Get('payment-gateway/providers')
  @UseGuards(JwtAuthGuard)
  getSupportedProviders() {
    return {
      supported: this.paymentGatewayService.getSupportedProviders(),
      all: Object.values(PaymentGatewayProvider),
    };
  }

  @Post('payment-gateway/config')
  @UseGuards(JwtAuthGuard)
  async createConfig(@Req() req: AuthRequest, @Body() dto: CreateGatewayConfigDto) {
    return this.paymentGatewayService.createConfig(req.user.businessId, dto);
  }

  @Patch('payment-gateway/config/:id')
  @UseGuards(JwtAuthGuard)
  async updateConfig(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateGatewayConfigDto,
  ) {
    return this.paymentGatewayService.updateConfig(req.user.businessId, id, dto);
  }

  @Delete('payment-gateway/config/:id')
  @UseGuards(JwtAuthGuard)
  async deleteConfig(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.paymentGatewayService.deleteConfig(req.user.businessId, id);
  }

  // ============== Payment Link Endpoints ==============

  @Post('invoices/:invoiceId/payment-link')
  @UseGuards(JwtAuthGuard)
  async createPaymentLink(
    @Req() req: AuthRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreatePaymentLinkDto,
  ) {
    return this.paymentGatewayService.createPaymentLink(req.user.businessId, invoiceId, dto);
  }

  @Get('invoices/:invoiceId/payment-link')
  @UseGuards(JwtAuthGuard)
  async getPaymentLink(
    @Req() req: AuthRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.paymentGatewayService.getPaymentLink(req.user.businessId, invoiceId);
  }

  @Delete('payment-links/:id')
  @UseGuards(JwtAuthGuard)
  async cancelPaymentLink(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.paymentGatewayService.cancelPaymentLink(req.user.businessId, id);
  }
}

// Separate controller for public webhook endpoints
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly paymentGatewayService: PaymentGatewayService) {}

  @Post('midtrans')
  @HttpCode(200)
  async midtransWebhook(
    @Body() payload: unknown,
    @Headers('x-midtrans-signature') signature?: string,
  ) {
    return this.paymentGatewayService.processWebhook(
      PaymentGatewayProvider.MIDTRANS,
      payload,
      signature,
    );
  }

  @Post('xendit')
  @HttpCode(200)
  async xenditWebhook(
    @Body() payload: unknown,
    @Headers('x-callback-token') signature?: string,
  ) {
    return this.paymentGatewayService.processWebhook(
      PaymentGatewayProvider.XENDIT,
      payload,
      signature,
    );
  }

  @Post('doku')
  @HttpCode(200)
  async dokuWebhook(
    @Body() payload: unknown,
    @Headers('signature') signature?: string,
  ) {
    return this.paymentGatewayService.processWebhook(
      PaymentGatewayProvider.DOKU,
      payload,
      signature,
    );
  }
}

// Public controller for customer payment page
@Controller('pay')
export class PublicPaymentController {
  constructor(private readonly paymentGatewayService: PaymentGatewayService) {}

  @Get(':linkId')
  async getPaymentDetails(@Param('linkId') linkId: string) {
    return this.paymentGatewayService.getPaymentLinkById(linkId);
  }
}
