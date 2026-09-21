import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({
    example: '68a123456789abcdef123456',
  })
  @IsMongoId()
  productId: string;

  @ApiProperty({
    example: 2,
  })
  @IsInt()
  @Min(1)
  quantity: number;
}
