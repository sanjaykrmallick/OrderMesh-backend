import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    example: 'IPHONE-17-PRO-256',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  sku: string;

  @ApiProperty({
    example: 'iPhone 17 Pro',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    example: 'iphone-17-pro',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  slug: string;

  @ApiPropertyOptional({
    example: 'Latest Apple flagship smartphone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    example: 129999,
    description:
      'Price in smallest currency unit. Example: ₹1299.99 = 129999 paise',
  })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  priceInCents: number;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/products/iphone.jpg',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(1000)
  imageUrl?: string;

  @ApiProperty({
    example: '66a123456789abcdef123456',
  })
  @IsString()
  categoryId: string;
}
