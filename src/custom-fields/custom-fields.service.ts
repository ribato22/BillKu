import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto, SetCustomFieldValueDto } from './dto';

@Injectable()
export class CustomFieldsService {
  constructor(private prisma: PrismaService) {}

  /**
   * List custom field definitions for an entity type
   */
  async findAll(businessId: string, entity?: string) {
    const where: Record<string, unknown> = { businessId };
    if (entity) where.entity = entity;

    return this.prisma.customField.findMany({
      where,
      orderBy: [{ entity: 'asc' }, { position: 'asc' }],
    });
  }

  /**
   * Create a new custom field definition
   */
  async create(businessId: string, data: CreateCustomFieldDto) {
    // Check for duplicate
    const existing = await this.prisma.customField.findFirst({
      where: {
        businessId,
        entity: data.entity,
        fieldName: data.fieldName,
      },
    });
    if (existing) {
      throw new ConflictException(`Field "${data.fieldName}" already exists for ${data.entity}`);
    }

    return this.prisma.customField.create({
      data: {
        businessId,
        entity: data.entity,
        fieldName: data.fieldName,
        fieldType: data.fieldType,
        options: data.options,
        isRequired: data.isRequired || false,
        position: data.position || 0,
      },
    });
  }

  /**
   * Update a custom field definition
   */
  async update(businessId: string, id: string, data: UpdateCustomFieldDto) {
    const existing = await this.prisma.customField.findFirst({
      where: { id, businessId },
    });
    if (!existing) throw new NotFoundException('Custom field not found');

    return this.prisma.customField.update({
      where: { id },
      data: {
        fieldName: data.fieldName,
        fieldType: data.fieldType,
        options: data.options,
        isRequired: data.isRequired,
        position: data.position,
      },
    });
  }

  /**
   * Delete a custom field (cascades to values)
   */
  async remove(businessId: string, id: string) {
    const existing = await this.prisma.customField.findFirst({
      where: { id, businessId },
    });
    if (!existing) throw new NotFoundException('Custom field not found');

    await this.prisma.customField.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Get all custom field values for a specific entity instance
   */
  async getValues(businessId: string, entity: string, entityId: string) {
    const fields = await this.prisma.customField.findMany({
      where: { businessId, entity },
      include: {
        values: {
          where: { entityId },
        },
      },
      orderBy: { position: 'asc' },
    });

    return fields.map((f) => ({
      id: f.id,
      fieldName: f.fieldName,
      fieldType: f.fieldType,
      options: f.options,
      isRequired: f.isRequired,
      value: f.values[0]?.value || null,
    }));
  }

  /**
   * Set a custom field value (upsert)
   */
  async setValue(businessId: string, data: SetCustomFieldValueDto) {
    // Verify field belongs to this business
    const field = await this.prisma.customField.findFirst({
      where: { id: data.customFieldId, businessId },
    });
    if (!field) throw new NotFoundException('Custom field not found');

    return this.prisma.customFieldValue.upsert({
      where: {
        customFieldId_entityId: {
          customFieldId: data.customFieldId,
          entityId: data.entityId,
        },
      },
      create: {
        customFieldId: data.customFieldId,
        entityId: data.entityId,
        value: data.value,
      },
      update: {
        value: data.value,
      },
    });
  }

  /**
   * Batch set values for an entity
   */
  async setValues(businessId: string, entityId: string, values: { customFieldId: string; value: string }[]) {
    const results = [];
    for (const v of values) {
      const result = await this.setValue(businessId, {
        customFieldId: v.customFieldId,
        entityId,
        value: v.value,
      });
      results.push(result);
    }
    return results;
  }
}
