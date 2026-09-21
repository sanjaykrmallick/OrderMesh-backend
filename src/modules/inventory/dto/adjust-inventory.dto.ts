import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { InventoryAdjustmentType } from '@prisma/client';

export class AdjustInventoryDto {
  @ApiProperty({
    example: 100,
    description:
      'Positive value adds available stock. Negative value removes available stock.',
  })
  @IsInt()
  @Min(-1000000)
  @Max(1000000)
  quantity: number;

  @ApiProperty({
    enum: InventoryAdjustmentType,
    example: InventoryAdjustmentType.RESTOCK,
  })
  @IsEnum(InventoryAdjustmentType)
  type: InventoryAdjustmentType;

  @ApiPropertyOptional({
    example: 'Initial warehouse stock received',
  })
  @IsOptional()
  @IsString()
  @Max(500)
  reason?: string;
}
