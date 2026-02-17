import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  businessId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Register a new user with a business
   */
  async register(email: string, password: string, businessName: string) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user, business, and owner membership in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          business: {
            create: {
              name: businessName,
              defaultCurrencyCode: 'IDR',
            },
          },
        },
        include: {
          business: true,
        },
      });

      // Auto-create owner membership
      if (newUser.business) {
        await tx.businessMember.create({
          data: {
            businessId: newUser.business.id,
            userId: newUser.id,
            role: 'owner',
          },
        });
      }

      return newUser;
    });

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.business!.id,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      business: {
        id: user.business!.id,
        name: user.business!.name,
      },
      ...tokens,
    };
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { business: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.business) {
      throw new UnauthorizedException('User has no business associated');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.business.id,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      business: {
        id: user.business.id,
        name: user.business.name,
      },
      ...tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret:
          process.env.JWT_SECRET || 'dev-secret-change-in-production',
      });

      // Verify user still exists
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { business: true },
      });

      if (!user || !user.business) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new access token only
      const accessToken = await this.generateAccessToken(
        user.id,
        user.email,
        user.business.id,
      );

      return { accessToken };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Get current user info
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { business: true },
    });

    if (!user || !user.business) {
      throw new UnauthorizedException('User not found');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      business: {
        id: user.business.id,
        name: user.business.name,
        defaultCurrencyCode: user.business.defaultCurrencyCode,
      },
    };
  }

  /**
   * Forgot password - generate reset token
   * Returns token regardless of whether email exists (prevent enumeration)
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { business: true },
    });

    if (!user) {
      // Don't reveal whether email exists
      return { message: 'If the email is registered, a reset link has been generated' };
    }

    // Generate a short-lived reset token (15 minutes)
    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, type: 'password_reset' },
      { expiresIn: 900 }, // 15 minutes
    );

    // In production, send email here via Nodemailer/Resend
    // For self-hosted MVP, return token directly
    return {
      message: 'If the email is registered, a reset link has been generated',
      resetToken, // In production, remove this and send via email
      resetUrl: `/reset-password?token=${resetToken}`,
    };
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      });

      if (payload.type !== 'password_reset') {
        throw new UnauthorizedException('Invalid reset token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid reset token');
      }

      // Hash and update password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      return { message: 'Password has been reset successfully' };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired reset token');
    }
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    userId: string,
    email: string,
    businessId: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      businessId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        expiresIn: 604800, // 7 days in seconds
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Generate access token only
   */
  private async generateAccessToken(
    userId: string,
    email: string,
    businessId: string,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      businessId,
    };

    return this.jwtService.signAsync(payload);
  }
}
