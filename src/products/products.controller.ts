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
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, AdjustStockDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';
import { AuditService } from '../audit/audit.service';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /products
   * List products with pagination
   */
  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.productsService.findAll(user.businessId, {
      page,
      pageSize,
      search,
      lowStock: lowStock === 'true',
    });
  }

  /**
   * GET /products/stock-summary
   * Get stock summary + low stock alerts
   */
  @Get('stock-summary')
  async getStockSummary(@CurrentUser() user: CurrentUserData) {
    const data = await this.productsService.getStockSummary(user.businessId);
    return { data };
  }

  /**
   * GET /products/:id
   * Get a single product
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const product = await this.productsService.findOne(user.businessId, id);
    return { data: product };
  }

  /**
   * POST /products
   * Create a new product
   */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateProductDto,
  ) {
    const product = await this.productsService.create(user.businessId, dto);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'create',
      resource: 'product',
      resourceId: product.id,
      changes: { name: dto.name, price: dto.price },
    });
    return { data: product };
  }

  /**
   * PATCH /products/:id
   * Update a product
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.productsService.update(user.businessId, id, dto);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'update',
      resource: 'product',
      resourceId: id,
      changes: dto as unknown as Record<string, unknown>,
    });
    return { data: product };
  }

  /**
   * POST /products/:id/adjust-stock
   * Adjust stock for a product
   */
  @Post(':id/adjust-stock')
  async adjustStock(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    const data = await this.productsService.adjustStock(
      user.businessId,
      id,
      dto.adjustment,
      dto.reason,
    );
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'adjust-stock',
      resource: 'product',
      resourceId: id,
      changes: { adjustment: dto.adjustment, reason: dto.reason },
    });
    return { data };
  }

  /**
   * DELETE /products/:id
   * Delete a product
   */
  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.productsService.remove(user.businessId, id);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'delete',
      resource: 'product',
      resourceId: id,
    });
    return { data: { success: true } };
  }
}
