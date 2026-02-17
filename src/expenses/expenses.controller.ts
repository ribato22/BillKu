import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';
import { AuditService } from '../audit/audit.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('categoryType') categoryType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.expensesService.findAll(user.businessId, {
      categoryType,
      from,
      to,
      page,
      limit,
    });
    return { data: result.data, pagination: result.pagination };
  }

  @Get('summary')
  async getSummary(
    @CurrentUser() user: CurrentUserData,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.expensesService.getSummary(user.businessId, from, to);
    return { data };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const data = await this.expensesService.findOne(user.businessId, id);
    return { data };
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateExpenseDto,
  ) {
    const data = await this.expensesService.create(user.businessId, dto);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'create',
      resource: 'expense',
      resourceId: data.id,
      changes: { description: dto.description, amount: dto.amount },
    });
    return { data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    const data = await this.expensesService.update(user.businessId, id, dto);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'update',
      resource: 'expense',
      resourceId: id,
      changes: dto as Record<string, unknown>,
    });
    return { data };
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.expensesService.remove(user.businessId, id);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'delete',
      resource: 'expense',
      resourceId: id,
    });
    return { data: { success: true } };
  }
}
