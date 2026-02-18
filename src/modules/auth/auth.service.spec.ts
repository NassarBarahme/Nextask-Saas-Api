import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { MailService } from '../mail/mail.service';
import { TokenService } from './token/token.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from 'src/generated/prisma/client';
import { SigninDto } from './dto/signin.dto';
import * as bcrypt from 'bcrypt';

jest.mock('src/common/utils/email-validation.util', () => ({
  validateRealEmail: jest.fn().mockResolvedValue({ valid: true }),
}));

describe('AuthService', () => {
  let authService: AuthService;
  const findUserByEmailMock = jest.fn();
  const createUnverifiedUserMock = jest.fn();
  const updateRefreshTokenMock = jest.fn();
  const sendVerificationEmailMock = jest.fn();
  const generateAccessTokenMock = jest.fn();
  const generateRefreshTokenMock = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthRepository,
          useValue: {
            findUserByEmail: findUserByEmailMock,
            createUnverifiedUser: createUnverifiedUserMock,
            updateRefreshToken: updateRefreshTokenMock,
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateAccessToken: generateAccessTokenMock,
            generateRefreshToken: generateRefreshTokenMock,
          },
        },
        {
          provide: MailService,
          useValue: {
            sendVerificationEmail: sendVerificationEmailMock,
          },
        },
      ],
    }).compile();
    authService = module.get<AuthService>(AuthService);
  });

  const userFactory = (data: Partial<User> = {}): User =>
    ({
      id: '1',
      name: 'test',
      email: 'test@g.com',
      password: 'hashed',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isVerified: false,
      phone: null,
      otpCode: null,
      otpExpires: null,
      refreshToken: null,
      activeOrganizationId: null,
      ...data,
    }) as User;

  const signUpDto: CreateUserDto = {
    name: 'test',
    email: 'test@g.com',
    password: 'Password123',
  };
  const signinDto: SigninDto = {
    email: 'test@g.com',
    password: 'Password123',
  };

  describe('signup (register)', () => {
    it('should call findUserByEmail then createUnverifiedUser when email is free', async () => {
      findUserByEmailMock.mockResolvedValue(null);
      createUnverifiedUserMock.mockResolvedValue(userFactory());

      await authService.signup(signUpDto);

      expect(findUserByEmailMock).toHaveBeenCalledWith(signUpDto.email);
      expect(createUnverifiedUserMock).toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already registered', async () => {
      findUserByEmailMock.mockResolvedValue(userFactory());

      await expect(authService.signup(signUpDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(authService.signup(signUpDto)).rejects.toThrow(
        'Email already registered',
      );
      expect(createUnverifiedUserMock).not.toHaveBeenCalled();
    });

    it('should hash password and pass hashed password to createUnverifiedUser', async () => {
      findUserByEmailMock.mockResolvedValue(null);
      createUnverifiedUserMock.mockResolvedValue(userFactory());

      await authService.signup(signUpDto);

      const createCall = createUnverifiedUserMock.mock.calls[0][0];
      expect(createCall.password).not.toBe(signUpDto.password);
      expect(createCall.password.length).toBeGreaterThan(20);
    });

    it('should send verification email with email and otpCode', async () => {
      findUserByEmailMock.mockResolvedValue(null);
      createUnverifiedUserMock.mockResolvedValue(userFactory());

      await authService.signup(signUpDto);

      expect(sendVerificationEmailMock).toHaveBeenCalledWith(
        signUpDto.email,
        expect.any(String),
      );
    });

    it('should return success message', async () => {
      findUserByEmailMock.mockResolvedValue(null);
      createUnverifiedUserMock.mockResolvedValue(userFactory());

      const result = await authService.signup(signUpDto);

      expect(result.message).toBe(
        'Please check your email to verify your account.',
      );
    });
  });
  describe('signin', () => {
    it('if user not found, should throw UnauthorizedException', async () => {
      findUserByEmailMock.mockResolvedValue(null);
      await expect(authService.signin(signinDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.signin(signinDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('if email found but not verified, should throw UnauthorizedException', async () => {
      findUserByEmailMock.mockResolvedValue(userFactory({ isVerified: false }));
      await expect(authService.signin(signinDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.signin(signinDto)).rejects.toThrow(
        'Account not verified',
      );
    });

    it('if password is incorrect, should throw UnauthorizedException', async () => {
      const wrongPasswordHash = await bcrypt.hash('WrongPassword', 10);
      findUserByEmailMock.mockResolvedValue(
        userFactory({
          password: wrongPasswordHash,
          isVerified: true,
        }),
      );
      await expect(authService.signin(signinDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.signin(signinDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('if user has no memberships, should throw ForbiddenException', async () => {
      const hashedPassword = await bcrypt.hash(signinDto.password, 10);
      const userNoMemberships = {
        ...userFactory({
          password: hashedPassword,
          isVerified: true,
        }),
        memberships: [],
      };
      findUserByEmailMock.mockResolvedValue(userNoMemberships);
      await expect(authService.signin(signinDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(authService.signin(signinDto)).rejects.toThrow(
        'User has no memberships',
      );
    });
    it('if user has active membership, should return auth response', async () => {
      const hashedPassword = await bcrypt.hash(signinDto.password, 10);
      const userWithMembership = {
        ...userFactory({
          password: hashedPassword,
          isVerified: true,
          activeOrganizationId: 'org1',
        }),
        memberships: [
          {
            id: 'm1',
            userId: '1',
            organizationId: 'org1',
            role: 'OWNER',
            createdAt: new Date(),
            updatedAt: new Date(),
            organization: { slug: 'test-org', name: 'Test Org' },
          },
        ],
      };
      findUserByEmailMock.mockResolvedValue(userWithMembership);
      generateAccessTokenMock.mockResolvedValue('access-token');
      generateRefreshTokenMock.mockResolvedValue('refresh-token');
      updateRefreshTokenMock.mockResolvedValue(undefined);

      const result = await authService.signin(signinDto);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('1');
      expect(result.user.email).toBe('test@g.com');
      expect(result.user.name).toBe('test');
    });
    it('if user has no memberships (undefined), should throw ForbiddenException', async () => {
      const hashedPassword = await bcrypt.hash(signinDto.password, 10);
      const userNoMemberships = {
        ...userFactory({
          password: hashedPassword,
          isVerified: true,
          activeOrganizationId: null,
        }),
      };
      findUserByEmailMock.mockResolvedValue(userNoMemberships);
      await expect(authService.signin(signinDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(authService.signin(signinDto)).rejects.toThrow(
        'User has no memberships',
      );
    });
  });
});
