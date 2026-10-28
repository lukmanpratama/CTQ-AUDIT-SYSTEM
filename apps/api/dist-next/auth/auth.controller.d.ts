import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    getProfile(user: {
        nik: string;
    }): Promise<{
        nik: string;
        namaUser: string;
        role: string;
        isActive: boolean;
    }>;
}
//# sourceMappingURL=auth.controller.d.ts.map