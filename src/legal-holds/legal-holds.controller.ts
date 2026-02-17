import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LegalHoldsService } from './legal-holds.service';
import { CreateLegalHoldDto, ReleaseLegalHoldDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('legal-holds')
@UseGuards(JwtAuthGuard)
export class LegalHoldsController {
  constructor(private readonly legalHoldsService: LegalHoldsService) {}

  /**
   * GET /legal-holds
   * List legal holds
   */
  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('active_only') activeOnly?: boolean,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    const result = await this.legalHoldsService.findAll(user.businessId, {
      activeOnly: activeOnly === true,
      page: page ?? 1,
      pageSize: pageSize ?? 20,
    });

    return {
      data: result.items,
      meta: result.meta,
    };
  }

  /**
   * GET /legal-holds/:id
   * Get a single legal hold
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const hold = await this.legalHoldsService.findOne(id, user.businessId);
    return { data: hold };
  }

  /**
   * POST /legal-holds
   * Create a new legal hold
   */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateLegalHoldDto,
  ) {
    const hold = await this.legalHoldsService.create(
      user.businessId,
      user.userId,
      dto,
    );

    return { data: hold };
  }

  /**
   * PATCH /legal-holds/:id/release
   * Release a legal hold
   */
  @Patch(':id/release')
  async release(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: ReleaseLegalHoldDto,
  ) {
    const hold = await this.legalHoldsService.release(
      id,
      user.businessId,
      user.userId,
    );

    return { data: hold };
  }
}

