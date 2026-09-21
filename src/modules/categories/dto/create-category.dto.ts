import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Electronics',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'electronics',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug: string;

  @ApiPropertyOptional({
    example: 'Electronic products and accessories',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
