import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PaymentActionDto {
  @ApiPropertyOptional({
    example: 'txn_123456789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  transactionId?: string;
}
