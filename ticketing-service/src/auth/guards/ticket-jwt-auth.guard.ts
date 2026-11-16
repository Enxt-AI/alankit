import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authentication guard for ticket operations
 * Validates session using SessionStrategy ('jwt').
 * Allows regular users, support agents, and admins.
 */
@Injectable()
export class TicketJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required for ticketing service');
    }
    return user;
  }
}
