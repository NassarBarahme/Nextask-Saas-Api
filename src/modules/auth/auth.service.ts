import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthRepository } from './auth.repository';
import * as bcrypt from 'bcrypt';
import { SigninDto } from './dto/signin.dto';
import { TokenPayload } from './token/token.payload';
import { TokenService } from './token/token.service';

@Injectable()
export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private tokenService: TokenService,
  ) {}
  async signup(createUserDto: CreateUserDto) {
    const { name, email, password } = createUserDto;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with default organization and membership in a transaction
    const { user } = await this.authRepository.createUserWithOrganization(
      name,
      email,
      hashedPassword,
    );

    // Return user without sensitive data
    const { password: _, refreshToken: __, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async signin(signinDto: SigninDto) {
    const { email, password } = signinDto;
    const user = await this.authRepository.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.memberships || user.memberships.length === 0) {
      throw new ForbiddenException('User has no memberships');
    }

    const currentMembership =
      user.memberships.find(
        (membership) => membership.organizationId === user.activeOrganizationId,
      ) || user.memberships[0];
    if (!currentMembership) {
      throw new UnauthorizedException('No active membership found');
    }
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: currentMembership.role,
      orgId: currentMembership.organizationId,
    };
    const accessToken = await this.tokenService.generateAccessToken(payload);
    const refreshToken = await this.tokenService.generateRefreshToken(payload);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.authRepository.updateRefreshToken(user.id, hashedRefreshToken);

    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: currentMembership.role,
        orgId: currentMembership.organizationId,
      },
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.authRepository.findUserById(userId);

    if (!user.refreshToken) {
      throw new ForbiddenException('Access Denied: Session expired');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );

    if (!refreshTokenMatches)
      throw new ForbiddenException('Access Denied: Token mismatch');

    const currentMembership =
      user.memberships.find(
        (m) => m.organizationId === user.activeOrganizationId,
      ) || user.memberships[0];

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: currentMembership.role,
      orgId: currentMembership.organizationId,
    };

    const [accessToken, newRefreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(payload),
      this.tokenService.generateRefreshToken(payload),
    ]);

    const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);
    await this.authRepository.updateRefreshToken(user.id, hashedRefreshToken);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: currentMembership.role,
        orgId: currentMembership.organizationId,
      },
    };
  }

  async logout(userId: string) {
    await this.authRepository.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }
}
