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
import { DeleteRequestsService } from './delete-requests.service';
import { CreateDeleteRequestDto, UpdateDeleteRequestDto } from './dto';
import { DeleteRequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('delete-requests')
@UseGuards(JwtAuthGuard)
export class DeleteRequestsController {
  constructor(private readonly deleteRequestsService: DeleteRequestsService) {}

  /**
   * GET /delete-requests
   * List delete requests
   */
  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('status') status?: DeleteRequestStatus,
    @Query('page') page?: number,
    @Query('page_size') pageSize?: number,
  ) {
    const result = await this.deleteRequestsService.findAll(user.businessId, {
      status,
      page: page ?? 1,
      pageSize: pageSize ?? 20,
    });

    return {
      data: result.items,
      meta: result.meta,
    };
  }

  /**
   * GET /delete-requests/:id
   * Get a single delete request
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const request = await this.deleteRequestsService.findOne(
      id,
      user.businessId,
    );

    return { data: request };
  }

  /**
   * POST /delete-requests
   * Create a new delete request
   */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateDeleteRequestDto,
  ) {
    const request = await this.deleteRequestsService.create(
      user.businessId,
      user.userId,
      dto,
    );

    return { data: request };
  }

  /**
   * PATCH /delete-requests/:id
   * Update delete request status
   */
  @Patch(':id')
  async updateStatus(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateDeleteRequestDto,
  ) {
    const request = await this.deleteRequestsService.updateStatus(
      id,
      user.businessId,
      user.userId,
      dto.status,
    );

    return { data: request };
  }
}

