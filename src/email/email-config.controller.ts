import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

class UpdateSmtpDto {
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsNumber()
  smtpPort?: number;

  @IsOptional()
  @IsString()
  smtpUser?: string;

  @IsOptional()
  @IsString()
  smtpPass?: string;

  @IsOptional()
  @IsString()
  smtpFrom?: string;
}

class TestEmailDto {
  @IsNotEmpty()
  @IsString()
  to!: string;
}

@Controller('email-config')
@UseGuards(JwtAuthGuard)
export class EmailConfigController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * GET /email-config — return current SMTP config (password masked)
   */
  @Get()
  async getConfig(@CurrentUser() user: CurrentUserData) {
    const business = await this.prisma.business.findUnique({
      where: { userId: user.userId },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        smtpFrom: true,
      },
    });

    if (!business) {
      return { data: null };
    }

    return {
      data: {
        smtpHost: business.smtpHost || '',
        smtpPort: business.smtpPort || 587,
        smtpUser: business.smtpUser || '',
        smtpPass: business.smtpPass ? '••••••••' : '',
        smtpFrom: business.smtpFrom || '',
        isConfigured: !!(business.smtpHost && business.smtpUser),
      },
    };
  }

  /**
   * PUT /email-config — save SMTP settings
   */
  @Put()
  async updateConfig(@CurrentUser() user: CurrentUserData, @Body() dto: UpdateSmtpDto) {
    // Don't overwrite password if masked value sent back
    const updateData: any = {};
    if (dto.smtpHost !== undefined) updateData.smtpHost = dto.smtpHost;
    if (dto.smtpPort !== undefined) updateData.smtpPort = dto.smtpPort;
    if (dto.smtpUser !== undefined) updateData.smtpUser = dto.smtpUser;
    if (dto.smtpFrom !== undefined) updateData.smtpFrom = dto.smtpFrom;
    // Only update password if it's not the masked placeholder
    if (dto.smtpPass && dto.smtpPass !== '••••••••') {
      updateData.smtpPass = dto.smtpPass;
    }

    await this.prisma.business.update({
      where: { userId: user.userId },
      data: updateData,
    });

    return { message: 'Konfigurasi SMTP berhasil disimpan' };
  }

  /**
   * POST /email-config/test — send a test email
   */
  @Post('test')
  async testEmail(@CurrentUser() user: CurrentUserData, @Body() dto: TestEmailDto) {
    const business = await this.prisma.business.findUnique({
      where: { userId: user.userId },
      select: {
        name: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        smtpFrom: true,
      },
    });

    if (!business?.smtpHost || !business?.smtpUser) {
      return {
        success: false,
        message: 'SMTP belum dikonfigurasi. Simpan pengaturan terlebih dahulu.',
      };
    }

    const result = await this.emailService.sendWithConfig(
      {
        to: dto.to,
        subject: `Test Email dari ${business.name} — BillKu`,
        html: `
          <div style="font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:20px">
            <div style="background:linear-gradient(135deg,#0f766e 0%,#14b8a6 100%);color:white;padding:24px;border-radius:8px 8px 0 0;text-align:center">
              <h2 style="margin:0">✅ Test Email Berhasil!</h2>
            </div>
            <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
              <p>Email ini dikirim sebagai test dari <strong>${business.name}</strong> via BillKu.</p>
              <p style="color:#6b7280;font-size:14px">Jika Anda menerima email ini, konfigurasi SMTP sudah benar.</p>
            </div>
          </div>
        `,
      },
      {
        host: business.smtpHost,
        port: business.smtpPort || 587,
        user: business.smtpUser,
        pass: business.smtpPass || '',
        from: business.smtpFrom || business.smtpUser,
      },
    );

    return {
      success: result.success,
      message: result.success
        ? `Email test berhasil dikirim ke ${dto.to}`
        : `Gagal mengirim email test: ${result.error || 'Periksa konfigurasi SMTP.'}`,
    };
  }
}
