import { Module } from '@nestjs/common';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],

  controllers: [PaymentsController],

  providers: [PaymentsService],

  exports: [PaymentsService],
})
export class PaymentsModule {}
