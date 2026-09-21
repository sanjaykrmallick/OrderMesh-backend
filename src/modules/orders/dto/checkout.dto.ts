import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({
    example: {
      name: 'Sanjay Kumar',
      phone: '9876543210',
      addressLine1: '123 Main Street',
      addressLine2: 'Near City Mall',
      city: 'Kolkata',
      state: 'West Bengal',
      postalCode: '700001',
      country: 'India',
    },
  })
  @IsObject()
  shippingAddress: Record<string, any>;

  @ApiPropertyOptional({
    example: 'Please deliver after 6 PM',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
