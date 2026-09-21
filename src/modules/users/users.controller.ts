import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

import { UsersService } from './users.service';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users/me
   */
  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
  })
  getMe(req: any) {
    return this.usersService.getMe(req.user.userId);
  }

  /**
   * PATCH /api/users/me
   */
  @Patch('me')
  @ApiOperation({
    summary: 'Update current user profile',
  })
  updateMe(req: any, @Body() updateProfileDto: UpdateProfileDto) {
    return this.usersService.updateMe(req.user.userId, updateProfileDto);
  }

  /**
   * DELETE /api/users/me
   */
  @Delete('me')
  @ApiOperation({
    summary: 'Deactivate current account',
  })
  deactivateMe(@Req() req: any) {
    return this.usersService.deactivateUser(req.user.userId);
  }

  /**
   * GET /api/users
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS)
  @ApiOperation({
    summary: 'Get users',
  })
  findAll(@Query() query: UsersQueryDto) {
    return this.usersService.findAll(query);
  }

  /**
   * GET /api/users/:id
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS)
  @ApiOperation({
    summary: 'Get user by ID',
  })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  /**
   * PATCH /api/users/:id
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update user',
  })
  updateUser(
    @Param('id') id: string,

    @Body()
    updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  /**
   * DELETE /api/users/:id
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Deactivate user',
  })
  deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }
}
