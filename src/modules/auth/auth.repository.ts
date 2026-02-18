import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  User,
  Organization,
  Membership,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { OrgType, Role } from 'src/generated/prisma/enums';
import { generateSlug, generateUniqueSlug } from 'src/common/utils/slug.util';

export type UserWithMemberships = Prisma.UserGetPayload<{
  include: {
    memberships: {
      include: {
        organization: {
          select: {
            slug: true;
            name: true;
          };
        };
      };
    };
  };
}>;

const USER_WITH_MEMBERSHIPS_INCLUDE = {
  memberships: {
    include: {
      organization: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  },
} as const satisfies Prisma.UserInclude;

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- User ---

  async findUserByEmail(email: string): Promise<UserWithMemberships | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: USER_WITH_MEMBERSHIPS_INCLUDE,
    });
  }

  async findUserById(userId: string): Promise<UserWithMemberships> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_WITH_MEMBERSHIPS_INCLUDE,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  async updateRefreshToken(
    userId: string,
    refreshToken: string | null,
  ): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      throw new InternalServerErrorException('Failed to update refresh token');
    }
  }

  // --- OTP / password reset ---

  async updateOtpCode(userId: string, otpCode: string, expires: Date) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        otpCode,
        otpExpires: expires,
      },
    });
  }

  async updatePasswordAndClearOtp(userId: string, hashedPassword: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        otpCode: null,
        otpExpires: null,
      },
    });
  }

  // --- Unverified user (signup) ---

  async createUnverifiedUser(data: {
    email: string;
    name: string;
    password: string;
    otpCode: string;
    otpExpires: Date;
  }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: data.password,
        isVerified: false,
        otpCode: data.otpCode,
        otpExpires: data.otpExpires,
      },
    });
  }

  async updateVerificationOtp(
    userId: string,
    otpCode: string,
    otpExpires: Date,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { otpCode, otpExpires },
    });
  }

  /** Set user verified and clear OTP */
  async setUserVerifiedAndClearOtp(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true, otpCode: null, otpExpires: null },
    });
  }

  /** Delete unverified users older than date (cleaner cron) */
  async deleteUnverifiedUsersOlderThan(before: Date): Promise<number> {
    const result = await this.prisma.user.deleteMany({
      where: {
        isVerified: false,
        createdAt: { lt: before },
      },
    });
    return result.count;
  }

  // --- Org + membership (verify-email) ---

  /**
   * Create org + membership + set isVerified in one transaction.
   */
  async createOrganizationAndMembershipForUser(
    userId: string,
    userName: string,
  ): Promise<{ organization: Organization; membership: Membership }> {
    const orgName = userName ? `${userName}'s Org` : `User's Org`;
    const baseSlug = generateSlug(orgName);
    const uniqueSlug = await generateUniqueSlug(baseSlug, async (slug) => {
      const existing = await this.prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      });
      return !!existing;
    });

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: orgName,
          slug: uniqueSlug,
          type: OrgType.RETAIL,
          isActive: true,
        },
      });
      const membership = await tx.membership.create({
        data: {
          userId,
          organizationId: organization.id,
          role: Role.OWNER,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          activeOrganizationId: organization.id,
          isVerified: true,
          otpCode: null,
          otpExpires: null,
        },
      });
      return { organization, membership };
    });
  }

  async createUserWithOrganization(
    name: string,
    email: string,
    hashedPassword: string,
  ): Promise<{
    user: User;
    organization: Organization;
    membership: Membership;
  }> {
    const orgName = name ? `${name}'s Org` : `User's Org`;
    const baseSlug = generateSlug(orgName);
    const uniqueSlug = await generateUniqueSlug(baseSlug, async (slug) => {
      const existing = await this.prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      });
      return !!existing;
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Create user
        const user = await tx.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            isVerified: true,
          },
        });

        // 2. Create org
        const organization = await tx.organization.create({
          data: {
            name: orgName,
            slug: uniqueSlug,
            type: OrgType.RETAIL,
            isActive: true,
          },
        });

        // 3. Create membership (Owner)
        const membership = await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: Role.OWNER,
          },
        });

        // 4. Set active org
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: { activeOrganizationId: organization.id },
        });

        return { user: updatedUser, organization, membership };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Email or Slug already in use');
      }
      throw new InternalServerErrorException(
        'Critical error during user creation',
      );
    }
  }
}
