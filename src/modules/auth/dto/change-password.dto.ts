import { IsString, MaxLength, MinLength } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword@123',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  currentPassword: string;

  @ApiProperty({
    example: 'NewPassword@123',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword: string;
}
