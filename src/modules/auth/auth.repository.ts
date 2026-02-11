import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User, Organization, Membership } from 'src/generated/prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { OrgType, Role } from 'src/generated/prisma/enums';

type UserWithMemberships = Prisma.UserGetPayload<{
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
  constructor(private readonly prisma: PrismaService) {}

  async createUser(
    name: string,
    email: string,
    hashedPassword: string,
  ): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    try {
      return await this.prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const field = error.meta?.target as string[];
          if (field?.includes('email')) {
            throw new BadRequestException('Email already in use');
          }
          if (field?.includes('phone')) {
            throw new BadRequestException('Phone number already in use');
          }
        }
      }

      throw new InternalServerErrorException('Failed to create user');
    }
  }

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

  async userExistsByEmail(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return user !== null;
  }

  async userExistsByPhone(phone: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    return user !== null;
  }

  /**
   * Generates a URL-friendly slug from a string
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Generates a unique slug by appending a suffix if needed
   */
  private async generateUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Creates a user with their default organization and membership in a single transaction.
   * This follows SaaS best practices for onboarding.
   */
  async createUserWithOrganization(
    name: string,
    email: string,
    hashedPassword: string,
  ): Promise<{
    user: User;
    organization: Organization;
    membership: Membership;
  }> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    // Generate organization name and slug
    const orgName = name ? `${name}'s Org` : `User's Org`;
    const baseSlug = this.generateSlug(orgName);
    const uniqueSlug = await this.generateUniqueSlug(baseSlug);

    try {
      // Use transaction to ensure atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Create the user
        const user = await tx.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
          },
        });

        // 2. Create the default organization
        const organization = await tx.organization.create({
          data: {
            name: orgName,
            slug: uniqueSlug,
            type: OrgType.RETAIL, // Default to RETAIL
            metadata: {},
            isActive: true,
          },
        });

        // 3. Create the membership with OWNER role
        const membership = await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: Role.OWNER,
          },
        });

        // 4. Update user's activeOrganizationId
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: { activeOrganizationId: organization.id },
        });

        return { user: updatedUser, organization, membership };
      });

      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const field = error.meta?.target as string[];
          if (field?.includes('email')) {
            throw new BadRequestException('Email already in use');
          }
          if (field?.includes('slug')) {
            throw new BadRequestException('Organization slug conflict');
          }
        }
      }

      throw new InternalServerErrorException(
        'Failed to create user with organization',
      );
    }
  }
}
