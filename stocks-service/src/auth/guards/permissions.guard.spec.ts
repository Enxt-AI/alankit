import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsGuard } from './permissions.guard';
import { Reflector } from '@nestjs/core';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('Explicit carousel permission', () => {
    const contextFor = (role: string, permissions?: string[]) => ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { type: 'CMS', role, permissions } }),
      }),
    });

    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['cms_carousel']);
    });

    it.each([
      ['CONTENT_MANAGER', ['cms_stocks', 'cms_articles', 'cms_news', 'cms_faqs', 'cms_static_pages', 'cms_baskets', 'cms_testimonials']],
      ['CONTENT_MANAGER', []],
      ['CONTENT_MANAGER', undefined],
      ['ADMIN', ['cms_static_pages']],
      ['ADMIN', ['cms_articles']],
      ['ADMIN', ['cms_testimonials']],
      ['CONTENT_MANAGER', ['manage_content']],
      ['ADMIN', ['manage_content']],
    ] as [string, string[] | undefined][])('denies %s with permissions %j', (role, permissions) => {
      expect(() => guard.canActivate(contextFor(role, permissions) as any)).toThrow(
        'Missing required permissions: cms_carousel',
      );
    });

    it('allows explicitly assigned carousel access', () => {
      expect(guard.canActivate(contextFor('CONTENT_MANAGER', ['cms_carousel']) as any)).toBe(true);
    });

    it('preserves super admin access', () => {
      expect(guard.canActivate(contextFor('SUPER_ADMIN', []) as any)).toBe(true);
    });

    it('denies access after carousel permission is revoked', () => {
      const permissions = ['cms_carousel'];
      const context = contextFor('CONTENT_MANAGER', permissions);
      expect(guard.canActivate(context as any)).toBe(true);
      permissions.pop();
      expect(() => guard.canActivate(context as any)).toThrow(
        'Missing required permissions: cms_carousel',
      );
    });
  });

  describe('Permission Mapping', () => {
    it('should grant CMS permissions to user with manage_content', () => {
      const mockExecutionContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn(() => ({
          getRequest: jest.fn(() => ({
            user: {
              type: 'ADMIN',
              role: 'ADMIN', // Not SUPER_ADMIN
              permissions: ['manage_content'],
            },
          })),
        })),
      };

      // Mock the reflector to return required permissions
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['cms_static_pages']);

      const result = guard.canActivate(mockExecutionContext as any);

      expect(result).toBe(true);
    });

    it('should deny access when user lacks required permissions and legacy permissions', () => {
      const mockExecutionContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn(() => ({
          getRequest: jest.fn(() => ({
            user: {
              type: 'ADMIN',
              role: 'ADMIN',
              permissions: ['some_other_permission'],
            },
          })),
        })),
      };

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['cms_static_pages']);

      expect(() => guard.canActivate(mockExecutionContext as any)).toThrow(
        'Missing required permissions: cms_static_pages',
      );
    });

    it('should grant access when user has direct CMS permission', () => {
      const mockExecutionContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn(() => ({
          getRequest: jest.fn(() => ({
            user: {
              type: 'ADMIN',
              role: 'ADMIN',
              permissions: ['cms_static_pages'],
            },
          })),
        })),
      };

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['cms_static_pages']);

      const result = guard.canActivate(mockExecutionContext as any);

      expect(result).toBe(true);
    });
  });
});
