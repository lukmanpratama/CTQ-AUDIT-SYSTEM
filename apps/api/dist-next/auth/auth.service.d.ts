import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService);
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            nik: string;
            namaUser: string;
            role: string;
            isActive: true;
        };
    }>;
    getProfile(nik: string): Promise<{
        nik: string;
        namaUser: string;
        role: string;
        isActive: boolean;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map