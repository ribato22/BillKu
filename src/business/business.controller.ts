import { Controller, Get, Patch, Post, Body, UseGuards, Param, Res } from '@nestjs/common';
import { BusinessService } from './business.service';
import { UpdateBusinessDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('business')
@UseGuards(JwtAuthGuard)
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  /**
   * GET /business
   * Get current user's business
   */
  @Get()
  async getBusiness(@CurrentUser() user: CurrentUserData) {
    const business = await this.businessService.findOne(user.businessId);
    return { data: business };
  }

  /**
   * PATCH /business
   * Update current user's business
   */
  @Patch()
  async updateBusiness(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateBusinessDto,
  ) {
    const business = await this.businessService.update(user.businessId, dto);
    return { data: business };
  }

  /**
   * POST /business/logo
   * Upload business logo (base64)
   */
  @Post('logo')
  async uploadLogo(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { logo: string },
  ) {
    const logoDir = path.join(process.cwd(), 'data', 'logos');
    if (!fs.existsSync(logoDir)) {
      fs.mkdirSync(logoDir, { recursive: true });
    }

    // Extract base64 data
    const matches = body.logo.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return { error: 'Format gambar tidak valid' };
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const data = matches[2];
    const filename = `${user.businessId}.${ext}`;
    const filepath = path.join(logoDir, filename);

    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));

    const logoUrl = `/api/v1/business/logo/${filename}`;
    await this.businessService.update(user.businessId, { logoUrl } as any);

    return { data: { logoUrl } };
  }

  /**
   * GET /business/logo/:filename
   * Serve logo file (public, no auth required)
   */
  @Public()
  @Get('logo/:filename')
  async serveLogo(@Param('filename') filename: string, @Res() res: Response) {
    const filepath = path.join(process.cwd(), 'data', 'logos', filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Logo tidak ditemukan' });
    }
    return res.sendFile(filepath);
  }

  /**
   * GET /business/currencies
   * Get available currencies
   */
  @Get('currencies')
  async getCurrencies() {
    const currencies = await this.businessService.getCurrencies();
    return { data: currencies };
  }
}
