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

  // --- ميثودات الـ User الأساسية ---

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

  // --- ميثودات الـ OTP والباسورد (للحسابات الموثقة فعلياً) ---

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

  // --- نظام الـ PendingUser (فلترة الإيميلات الوهمية) ---

  // 1. إضافة await قبل this.prisma
  async createPendingUser(data: {
    email: string;
    name: string;
    password: string;
    otpCode: string;
    expiresAt: Date;
  }) {
    return await this.prisma.pendingUser.upsert({
      where: { email: data.email },
      update: data,
      create: data,
    });
  }

  // 2. إضافة await
  async findPendingUser(email: string) {
    return await this.prisma.pendingUser.findUnique({
      where: { email },
    });
  }

  async deletePendingUser(email: string) {
    try {
      return await this.prisma.pendingUser.delete({
        where: { email },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to delete PendingUser for email "${email}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  // --- ميثودات الإنشاء المعقدة (Transaction) ---

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
        // 1. إنشاء المستخدم الحقيقي (لأنه عدى مرحلة الـ OTP)
        const user = await tx.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            isVerified: true, // الحساب صار موثق فور الإنشاء هنا
          },
        });

        // 2. إنشاء المنظمة
        const organization = await tx.organization.create({
          data: {
            name: orgName,
            slug: uniqueSlug,
            type: OrgType.RETAIL,
            isActive: true,
          },
        });

        // 3. إنشاء العضوية (Owner)
        const membership = await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: Role.OWNER,
          },
        });

        // 4. تعيين المنظمة النشطة
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
