import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';
import { AuditService } from '../audit/audit.service';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /customers
   * List customers with pagination
   */
  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
  ) {
    const result = await this.customersService.findAll(user.businessId, {
      page,
      pageSize,
      search,
    });
    return result;
  }

  /**
   * GET /customers/:id
   * Get a single customer
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const customer = await this.customersService.findOne(user.businessId, id);
    return { data: customer };
  }

  /**
   * POST /customers
   * Create a new customer
   */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateCustomerDto,
  ) {
    const customer = await this.customersService.create(user.businessId, dto);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'create',
      resource: 'customer',
      resourceId: customer.id,
      changes: { name: dto.name, email: dto.email },
    });
    return { data: customer };
  }

  /**
   * POST /customers/import
   * Import customers from CSV text
   * Expected CSV format: name,email,phone,address (first row = header)
   */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importCsv(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { csv: string },
  ) {
    const lines = body.csv.trim().split('\n');
    if (lines.length < 2) {
      return { data: { imported: 0, errors: ['CSV must have header + at least 1 data row'] } };
    }

    // Parse header to detect delimiter
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/"/g, ''));

    const nameIdx = headers.findIndex((h) => h === 'name' || h === 'nama');
    const emailIdx = headers.findIndex((h) => h === 'email');
    const phoneIdx = headers.findIndex((h) => h === 'phone' || h === 'telepon' || h === 'hp' || h === 'no_hp');
    const addressIdx = headers.findIndex((h) => h === 'address' || h === 'alamat');

    if (nameIdx === -1) {
      return { data: { imported: 0, errors: ['CSV must have a "name" or "nama" column'] } };
    }

    const errors: string[] = [];
    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
      const name = cols[nameIdx];

      if (!name) {
        errors.push(`Row ${i + 1}: name is empty`);
        continue;
      }

      try {
        await this.customersService.create(user.businessId, {
          name,
          email: emailIdx >= 0 ? cols[emailIdx] || undefined : undefined,
          phone: phoneIdx >= 0 ? cols[phoneIdx] || undefined : undefined,
          address: addressIdx >= 0 ? cols[addressIdx] || undefined : undefined,
        } as CreateCustomerDto);
        imported++;
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return { data: { imported, total: lines.length - 1, errors } };
  }

  /**
   * PATCH /customers/:id
   * Update a customer
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const customer = await this.customersService.update(
      user.businessId,
      id,
      dto,
    );
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'update',
      resource: 'customer',
      resourceId: id,
      changes: dto as unknown as Record<string, unknown>,
    });
    return { data: customer };
  }

  /**
   * DELETE /customers/:id
   * Soft delete a customer
   */
  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.customersService.remove(user.businessId, id);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'delete',
      resource: 'customer',
      resourceId: id,
    });
    return { data: { success: true } };
  }
}

