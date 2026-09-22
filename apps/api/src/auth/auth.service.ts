// apps/api/src/auth/auth.service.ts
// Authentication business logic — login, token generation

import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    // 1. Find user by NIK
    const user = await this.prisma.masterUser.findUnique({
      where: { nik: dto.nik },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Verify password with Argon2id
    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Generate tokens
    const payload = { sub: user.nik, role: user.role };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    this.logger.log(`User ${user.nik} (${user.role}) logged in`);

    return {
      accessToken,
      refreshToken,
      user: {
        nik: user.nik,
        namaUser: user.namaUser,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  async getProfile(nik: string) {
    const user = await this.prisma.masterUser.findUnique({
      where: { nik },
      select: {
        nik: true,
        namaUser: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
