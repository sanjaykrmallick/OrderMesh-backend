import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '@prisma/client';

import { InventoryService } from './inventory.service';

import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';
import { ReleaseInventoryDto } from './dto/release-inventory.dto';

import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Inventory')
@ApiBearerAuth('access-token')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS, UserRole.WAREHOUSE)
  @ApiOperation({
    summary: 'Get inventory',
  })
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get(':productId')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS, UserRole.WAREHOUSE)
  @ApiOperation({
    summary: 'Get inventory by product ID',
  })
  findByProductId(
    @Param('productId')
    productId: string,
  ) {
    return this.inventoryService.findByProductId(productId);
  }

  @Post(':productId/adjust')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS, UserRole.WAREHOUSE)
  @ApiOperation({
    summary: 'Adjust inventory',
  })
  adjust(
    @Param('productId')
    productId: string,

    @Body()
    dto: AdjustInventoryDto,
  ) {
    return this.inventoryService.adjust(productId, dto);
  }

  @Post(':productId/reserve')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS)
  @ApiOperation({
    summary: 'Reserve inventory',
  })
  reserve(
    @Param('productId')
    productId: string,

    @Body()
    dto: ReserveInventoryDto,
  ) {
    return this.inventoryService.reserve(productId, dto);
  }

  @Post(':productId/release')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS)
  @ApiOperation({
    summary: 'Release reserved inventory',
  })
  release(
    @Param('productId')
    productId: string,

    @Body()
    dto: ReleaseInventoryDto,
  ) {
    return this.inventoryService.release(productId, dto);
  }
}
