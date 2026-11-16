import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { encryptToken, OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES } from 'cookie-crypto';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import {
  SendPanelForgotPasswordOtpDto,
  VerifyPanelForgotPasswordOtpDto,
  ResetPanelPasswordDto,
} from './dto/forgot-password.dto';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { CmsJwtAuthGuard } from './guards/cms-jwt-auth.guard';
import { SupportJwtAuthGuard } from './guards/support-jwt-auth.guard';
import { MarketingJwtAuthGuard } from './guards/marketing-jwt-auth.guard';
import { AccountingJwtAuthGuard } from './guards/accounting-jwt-auth.guard';
import { OperationJwtAuthGuard } from './guards/operation-jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { PinoNestLogger } from '@smc/logger';

@Controller('auth')
export class AuthController {
  private readonly logger = new PinoNestLogger('stocks-service', 'AuthController');
  constructor(private authService: AuthService) {}

  /**
   * Shared login helper for admin, CMS, and support panels
   * Handles common validation, token generation, cookie setting, and response formatting
   */
  private async performPanelLogin(
    dto: AdminLoginDto,
    allowedRoles: string[],
    cookieName: string,
    res: FastifyReply,
    req?: any,
  ) {
    this.logger.log(
      `[LOGIN] Auth Controller - Login attempt for: ${dto.email} (${cookieName})`,
    );

    try {
      // Validate admin credentials
      const admin = await this.authService.validateAdmin(
        dto.email,
        dto.password,
      );

      // Check if admin has required role
      if (!allowedRoles.includes(admin.role)) {
        this.logger.log(
          `[ERROR] Auth Controller - Access denied for ${cookieName}:`,
          admin.role,
        );
        throw new UnauthorizedException(
          `Access denied. Required roles: ${allowedRoles.join(', ')}.`,
        );
      }

      // Generate JWT token
      const token = await this.authService.generateAdminToken(
        admin.id,
        admin.email,
        admin.role,
        admin.permissions,
        req,
      );

      // Set cookie (token value encrypted via AES-256-GCM)
      res.setCookie(cookieName, encryptToken(token, process.env.COOKIE_ENCRYPTION_KEY!), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
        sameSite: 'lax',
        path: '/',
      });

      // Update last login
      await this.authService.updateLastLogin(admin.id);

      this.logger.log(
        `[SUCCESS] Auth Controller - Login successful, cookie set for: ${admin.email} (${cookieName})`,
      );

      return {
        success: true,
        admin: {
          id: admin.id,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role,
          permissions: admin.permissions,
        },
      };
    } catch (error) {
      this.logger.log(
        `[ERROR] Auth Controller - Login failed (${cookieName}):`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * POST /api/auth/admin/login
   * Admin panel login - sets admin_panel_token cookie on stocks-service domain
   */
  @Post('admin/login')
  @Public()
  @HttpCode(200)
  async adminLogin(
    @Req() req: any,
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return this.performPanelLogin(
      dto,
      ['ADMIN', 'SUPER_ADMIN'],
      OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN,
      res,
      req,
    );
  }

  /**
   * POST /api/auth/cms/login
   * CMS panel login - sets cms_panel_token cookie on stocks-service domain
   */
  @Post('cms/login')
  @Public()
  @HttpCode(200)
  async cmsLogin(
    @Req() req: any,
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return this.performPanelLogin(
      dto,
      ['CONTENT_MANAGER', 'SUPER_ADMIN'],
      OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN,
      res,
      req,
    );
  }

  /**
   * POST /api/auth/admin/logout
   * Admin panel logout - clears admin_panel_token cookie
   */
  @Post('admin/logout')
  @Public()
  @HttpCode(200)
  async adminLogout(@Res({ passthrough: true }) res: FastifyReply) {
    this.logger.log('[LOGOUT] Auth Controller - Admin logout');

    res.clearCookie(OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });
    res.clearCookie(ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });

    this.logger.log(
      '[SUCCESS] Auth Controller - Admin logout successful, cookie cleared',
    );
    return { success: true };
  }

  /**
   * POST /api/auth/cms/logout
   * CMS panel logout - clears cms_panel_token cookie
   */
  @Post('cms/logout')
  @Public()
  @HttpCode(200)
  async cmsLogout(@Res({ passthrough: true }) res: FastifyReply) {
    this.logger.log('[LOGOUT] Auth Controller - CMS logout');

    res.clearCookie(OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });
    res.clearCookie(ORIGINAL_COOKIE_NAMES.CMS_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });

    this.logger.log(
      '[SUCCESS] Auth Controller - CMS logout successful, cookie cleared',
    );
    return { success: true };
  }

  /**
   * GET /api/auth/admin/verify
   * Verify admin panel session from admin_panel_token cookie
   */
  @Get('admin/verify')
  @UseGuards(AdminJwtAuthGuard)
  @HttpCode(200)
  async verifyAdminSession(@Req() req: any) {
    this.logger.log('[VERIFY] Auth Controller - Verifying admin session');

    const adminId = req.user.adminId;
    const admin = await this.authService.getAdminById(adminId);

    this.logger.log(
      '[SUCCESS] Auth Controller - Admin session verified for:',
      admin.email,
    );

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  /**
   * GET /api/auth/cms/verify
   * Verify CMS panel session from cms_panel_token cookie
   */
  @Get('cms/verify')
  @UseGuards(CmsJwtAuthGuard)
  @HttpCode(200)
  async verifyCmsSession(@Req() req: any) {
    this.logger.log('[VERIFY] Auth Controller - Verifying CMS session');

    const adminId = req.user.adminId;
    const admin = await this.authService.getAdminById(adminId);

    this.logger.log(
      '[SUCCESS] Auth Controller - CMS session verified for:',
      admin.email,
    );

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  /**
   * POST /api/auth/marketing/login
   * Marketing panel login - sets marketing_panel_token cookie on stocks-service domain
   */
  @Post('marketing/login')
  @Public()
  @HttpCode(200)
  async marketingLogin(
    @Req() req: any,
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return this.performPanelLogin(
      dto,
      ['MARKETING_MANAGER', 'SUPER_ADMIN', 'SALES_EMPLOYEE'],
      OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN,
      res,
      req,
    );
  }

  /**
   * POST /api/auth/marketing/logout
   * Marketing panel logout - clears marketing_panel_token cookie
   */
  @Post('marketing/logout')
  @Public()
  @HttpCode(200)
  async marketingLogout(@Res({ passthrough: true }) res: FastifyReply) {
    this.logger.log('[LOGOUT] Auth Controller - Marketing logout');

    res.clearCookie(OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });
    res.clearCookie(ORIGINAL_COOKIE_NAMES.MARKETING_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });

    this.logger.log(
      '[SUCCESS] Auth Controller - Marketing logout successful, cookie cleared',
    );
    return { success: true };
  }

  /**
   * GET /api/auth/marketing/verify
   * Verify Marketing panel session from marketing_panel_token cookie
   */
  @Get('marketing/verify')
  @UseGuards(MarketingJwtAuthGuard)
  @HttpCode(200)
  async verifyMarketingSession(@Req() req: any) {
    this.logger.log('[VERIFY] Auth Controller - Verifying Marketing session');

    const adminId = req.user.adminId;
    const admin = await this.authService.getAdminById(adminId);

    this.logger.log(
      '[SUCCESS] Auth Controller - Marketing session verified for:',
      admin.email,
    );

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  /**
   * POST /api/auth/support/login
   * Support panel login - sets support_panel_token cookie on stocks-service domain
   * Also returns token for cross-service authentication
   */
  @Post('support/login')
  @Public()
  @HttpCode(200)
  async supportLogin(
    @Req() req: any,
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    this.logger.log(
      `[LOGIN] Auth Controller - Support login attempt for: ${dto.email}`,
    );

    try {
      // Validate admin credentials
      const admin = await this.authService.validateAdmin(
        dto.email,
        dto.password,
      );

      // Check if admin has required role
      if (!['SUPPORT_AGENT', 'SUPER_ADMIN'].includes(admin.role)) {
        this.logger.log(
          `[ERROR] Auth Controller - Access denied for support login:`,
          admin.role,
        );
        throw new UnauthorizedException(
          `Access denied. Required roles: SUPPORT_AGENT, SUPER_ADMIN.`,
        );
      }

      // Generate JWT token
      const token = await this.authService.generateAdminToken(
        admin.id,
        admin.email,
        admin.role,
        admin.permissions,
        req,
      );

      // Set HttpOnly cookie for same-domain requests (encrypted via AES-256-GCM, obfuscated name)
      res.setCookie(OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN, encryptToken(token, process.env.COOKIE_ENCRYPTION_KEY!), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
        sameSite: 'lax',
        path: '/',
      });

      // Update last login
      await this.authService.updateLastLogin(admin.id);

      this.logger.log(
        `[SUCCESS] Auth Controller - Support login successful, cookie set for: ${admin.email}`,
      );

      return {
        success: true,
        token, // Return token for cross-service authentication
        admin: {
          id: admin.id,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role,
          permissions: admin.permissions,
        },
      };
    } catch (error) {
      this.logger.log(
        `[ERROR] Auth Controller - Support login failed:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * POST /api/auth/support/logout
   * Support panel logout - clears support_panel_token cookie
   */
  @Post('support/logout')
  @Public()
  @HttpCode(200)
  async supportLogout(@Res({ passthrough: true }) res: FastifyReply) {
    this.logger.log('[LOGOUT] Auth Controller - Support logout');

    res.clearCookie(OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });
    res.clearCookie(ORIGINAL_COOKIE_NAMES.SUPPORT_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });

    this.logger.log(
      '[SUCCESS] Auth Controller - Support logout successful, cookie cleared',
    );
    return { success: true };
  }

  /**
   * GET /api/auth/support/verify
   * Verify support panel session from support_panel_token cookie
   */
  @Get('support/verify')
  @UseGuards(SupportJwtAuthGuard)
  @HttpCode(200)
  async verifySupportSession(@Req() req: any) {
    this.logger.log('[VERIFY] Auth Controller - Verifying support session');

    const adminId = req.user.adminId;
    const admin = await this.authService.getAdminById(adminId);

    this.logger.log(
      '[SUCCESS] Auth Controller - Support session verified for:',
      admin.email,
    );

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  // NOTE: RM login/logout/verify endpoints were removed as part of RM system deprecation.
  // SMC will build RM functionality as a separate project.

  /**
   * POST /api/auth/accounting/login
   * Accounting panel login - sets accounting_panel_token cookie on stocks-service domain
   */
  @Post('accounting/login')
  @Public()
  @HttpCode(200)
  async accountingLogin(
    @Req() req: any,
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return this.performPanelLogin(
      dto,
      ['ACCOUNTANT', 'SUPER_ADMIN'],
      OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN,
      res,
      req,
    );
  }

  /**
   * POST /api/auth/accounting/logout
   * Accounting panel logout - clears accounting_panel_token cookie
   */
  @Post('accounting/logout')
  @Public()
  @HttpCode(200)
  async accountingLogout(@Res({ passthrough: true }) res: FastifyReply) {
    this.logger.log('[LOGOUT] Auth Controller - Accounting logout');

    res.clearCookie(OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });
    res.clearCookie(ORIGINAL_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });

    this.logger.log(
      '[SUCCESS] Auth Controller - Accounting logout successful, cookie cleared',
    );
    return { success: true };
  }

  /**
   * GET /api/auth/accounting/verify
   * Verify accounting panel session from accounting_panel_token cookie
   */
  @Get('accounting/verify')
  @UseGuards(AccountingJwtAuthGuard)
  @HttpCode(200)
  async verifyAccountingSession(@Req() req: any) {
    this.logger.log('[VERIFY] Auth Controller - Verifying accounting session');

    const adminId = req.user.adminId;
    const admin = await this.authService.getAdminById(adminId);

    this.logger.log(
      '[SUCCESS] Auth Controller - Accounting session verified for:',
      admin.email,
    );

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  /**
   * POST /api/auth/operation/login
   * Operation panel login - sets operation_panel_token cookie on stocks-service domain
   */
  @Post('operation/login')
  @Public()
  @HttpCode(200)
  async operationLogin(
    @Req() req: any,
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return this.performPanelLogin(
      dto,
      ['OPERATIONS', 'SUPER_ADMIN'],
      OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN,
      res,
      req,
    );
  }

  /**
   * POST /api/auth/operation/logout
   * Operation panel logout - clears operation_panel_token cookie
   */
  @Post('operation/logout')
  @Public()
  @HttpCode(200)
  async operationLogout(@Res({ passthrough: true }) res: FastifyReply) {
    this.logger.log('[LOGOUT] Auth Controller - Operation logout');

    res.clearCookie(OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });
    res.clearCookie(ORIGINAL_COOKIE_NAMES.OPERATION_PANEL_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      path: '/',
    });

    this.logger.log(
      '[SUCCESS] Auth Controller - Operation logout successful, cookie cleared',
    );
    return { success: true };
  }

  /**
   * GET /api/auth/operation/verify
   * Verify operation panel session from operation_panel_token cookie
   */
  @Get('operation/verify')
  @UseGuards(OperationJwtAuthGuard)
  @HttpCode(200)
  async verifyOperationSession(@Req() req: any) {
    this.logger.log('[VERIFY] Auth Controller - Verifying operation session');

    const adminId = req.user.adminId;
    const admin = await this.authService.getAdminById(adminId);

    this.logger.log(
      '[SUCCESS] Auth Controller - Operation session verified for:',
      admin.email,
    );

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  /**
   * POST /api/auth/panel/forgot-password/send-otp
   * Request OTP for panel user forgot password
   */
  @Post('panel/forgot-password/send-otp')
  @Public()
  @HttpCode(200)
  async sendPanelForgotPasswordOtp(@Body() dto: SendPanelForgotPasswordOtpDto) {
    return this.authService.sendPanelForgotPasswordOtp(dto.email);
  }

  /**
   * POST /api/auth/panel/forgot-password/verify-otp
   * Verify OTP for panel user forgot password
   */
  @Post('panel/forgot-password/verify-otp')
  @Public()
  @HttpCode(200)
  async verifyPanelForgotPasswordOtp(@Body() dto: VerifyPanelForgotPasswordOtpDto) {
    return this.authService.verifyPanelForgotPasswordOtp(dto.email, dto.otp);
  }

  /**
   * POST /api/auth/panel/forgot-password/reset-password
   * Reset password for panel user after OTP verification
   */
  @Post('panel/forgot-password/reset-password')
  @Public()
  @HttpCode(200)
  async resetPanelPassword(@Body() dto: ResetPanelPasswordDto) {
    return this.authService.resetPanelPassword(
      dto.email,
      dto.resetToken,
      dto.newPassword,
    );
  }
}
