import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto, SetCustomFieldValueDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('custom-fields')
@UseGuards(JwtAuthGuard)
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}

  /**
   * GET /custom-fields?entity=invoice
   * List custom field definitions
   */
  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('entity') entity?: string,
  ) {
    const data = await this.service.findAll(user.businessId, entity);
    return { data };
  }

  /**
   * POST /custom-fields
   * Create a new custom field definition
   */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateCustomFieldDto,
  ) {
    const data = await this.service.create(user.businessId, dto);
    return { data };
  }

  /**
   * PUT /custom-fields/:id
   * Update a custom field definition
   */
  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    const data = await this.service.update(user.businessId, id, dto);
    return { data };
  }

  /**
   * DELETE /custom-fields/:id
   * Delete a custom field
   */
  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const data = await this.service.remove(user.businessId, id);
    return { data };
  }

  /**
   * GET /custom-fields/values/:entity/:entityId
   * Get field values for a specific entity instance
   */
  @Get('values/:entity/:entityId')
  async getValues(
    @CurrentUser() user: CurrentUserData,
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
  ) {
    const data = await this.service.getValues(user.businessId, entity, entityId);
    return { data };
  }

  /**
   * POST /custom-fields/values
   * Set a custom field value
   */
  @Post('values')
  async setValue(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SetCustomFieldValueDto,
  ) {
    const data = await this.service.setValue(user.businessId, dto);
    return { data };
  }

  /**
   * POST /custom-fields/values/batch/:entityId
   * Batch set field values for an entity
   */
  @Post('values/batch/:entityId')
  async setValues(
    @CurrentUser() user: CurrentUserData,
    @Param('entityId') entityId: string,
    @Body() body: { values: { customFieldId: string; value: string }[] },
  ) {
    const data = await this.service.setValues(user.businessId, entityId, body.values);
    return { data };
  }
}
