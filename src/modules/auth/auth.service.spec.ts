import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { MailService } from '../mail/mail.service';
import { TokenService } from './token/token.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from 'src/generated/prisma/client';

jest.mock('src/common/utils/email-validation.util', () => ({
  validateRealEmail: jest.fn().mockResolvedValue({ valid: true }),
}));

describe('AuthService', () => {
  let authService: AuthService;
  const findUserByEmailMock = jest.fn();
  const createUnverifiedUserMock = jest.fn();
  const sendVerificationEmailMock = jest.fn();

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
          },
        },
        {
          provide: TokenService,
          useValue: {},
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
});
