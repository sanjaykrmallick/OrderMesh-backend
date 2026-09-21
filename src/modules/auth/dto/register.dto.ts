import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'customer@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '9876543210',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  phone: string;

  @ApiProperty({
    example: 'Password@123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @ApiProperty({
    example: 'Sanjay',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({
    example: 'Kumar',
    required: false,
  })
  @IsString()
  @MaxLength(50)
  lastName?: string;
}
