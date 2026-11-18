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
