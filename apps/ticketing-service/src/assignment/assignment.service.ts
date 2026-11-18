import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPrismaService } from '../prisma/admin-prisma.service';
import { TicketHistoryService } from '../ticket-history/ticket-history.service';
import { NotificationService } from '../notification/notification.service';
import { Ticket } from 'db-ticketing';
import { Admin } from 'db-unlisted-stox';

@Injectable()
export class AssignmentService {
  private readonly logger = new PinoNestLogger('ticketing-service', 'AssignmentService');
  // In-memory Round-Robin state tracker (can be upgraded to Redis later)
  private lastAssignedAgentIndex: Map<string, number> = new Map();

  constructor(
    private prisma: PrismaService,
    private adminPrisma: AdminPrismaService,
    private ticketHistoryService: TicketHistoryService,
    private notificationService: NotificationService,
    private configService: ConfigService,
  ) {}

  /**
   * Automatically assign a ticket based on configured strategy
   * @param ticketId - ID of ticket to assign
   * @returns Assigned ticket or null if no agents available
   */
  async autoAssignTicket(ticketId: string): Promise<Ticket | null> {
    const strategy = this.configService.get<string>(
      'TICKET_ASSIGNMENT_STRATEGY',
      'round-robin',
    );

    this.logger.log(
      `[PROCESSING] Auto-assigning ticket ${ticketId} using strategy: ${strategy}`,
    );

    switch (strategy) {
      case 'round-robin':
        return await this.assignTicketRoundRobin(ticketId);
      case 'workload':
        return await this.assignTicketByWorkload(ticketId);
      default:
        throw new BadRequestException(
          `Invalid assignment strategy: ${strategy}. Valid options: 'round-robin', 'workload'`,
        );
    }
  }

  /**
   * Manually assign a ticket to a specific agent
   * @param ticketId - ID of ticket to assign
   * @param agentId - ID of agent to assign to
   * @param assignedBy - ID of user performing the assignment
   * @returns Updated ticket
   */
  async assignTicket(
    ticketId: string,
    agentId: string,
    assignedBy: string,
  ): Promise<Ticket> {
    // Validate ticket exists
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }

    // Validate agent exists and is SUPPORT_AGENT
    const agent = await this.adminPrisma.admin.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    if (agent.role !== 'SUPPORT_AGENT') {
      throw new BadRequestException(
        `Agent ${agentId} is not a SUPPORT_AGENT (role: ${agent.role})`,
      );
    }

    // Check agent availability (log warning but proceed)
    if (agent.availability !== 'available') {
      this.logger.warn(
        `[WARNING] Assigning ticket ${ticketId} to unavailable agent ${agentId} (status: ${agent.availability})`,
      );
    }

    const previousAgentId = ticket.assignedTo;

    // If ticket was previously assigned to a different agent, decrement their count
    if (previousAgentId && previousAgentId !== agentId) {
      await this.decrementAgentTicketCount(previousAgentId);
    }

    // Update ticket assignment and status
    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedTo: agentId,
      },
    });

    // Increment new agent's active ticket count
    await this.incrementAgentTicketCount(agentId);

    // Log assignment to ticket history
    await this.ticketHistoryService.logChange(
      ticketId,
      'assigned',
      assignedBy,
      'assignedTo',
      previousAgentId,
      agentId,
    );

    // Send assignment notification to Agent
    await this.notificationService.sendAssignmentEmail(updatedTicket, agent);

    // Send assignment notification to User (Background)
    try {
      const user = await this.adminPrisma.user.findUnique({
        where: { id: ticket.createdBy },
        select: { id: true, email: true, fullName: true },
      });
      if (user && user.email) {
        this.notificationService.sendTicketAssignedToUserNotification(
          updatedTicket,
          { fullName: agent.fullName },
          { email: user.email, fullName: user.fullName }
        ).catch(err => this.logger.error(`Failed to send user assignment notification for ticket ${ticketId}`, err));
      }
    } catch (e) {
      this.logger.error(`Failed to fetch user for ticket assignment notification ${ticketId}`, e);
    }

    this.logger.log(
      `[SUCCESS] Assigned ticket ${ticketId} to agent ${agentId} (${agent.email})`,
    );

    return updatedTicket;
  }

  /**
   * Unassign a ticket (decrement agent's active count)
   * Called when ticket is resolved/closed
   * @param ticketId - ID of ticket to unassign
   */
  async unassignTicket(ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, assignedTo: true },
    });

    if (!ticket) {
      this.logger.warn(
        `[WARNING] Cannot unassign ticket ${ticketId}: ticket not found`,
      );
      return;
    }

    if (ticket.assignedTo) {
      await this.decrementAgentTicketCount(ticket.assignedTo);

      // Clear assignment
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { assignedTo: null },
      });

      this.logger.log(
        `[PROCESSING] Unassigned ticket ${ticketId} from agent ${ticket.assignedTo}`,
      );
    }
  }

  /**
   * Get all available support agents, with fallback to all active agents if none available
   * @returns Array of available SUPPORT_AGENT admins, or all active ones if none available
   */
  private async getAvailableAgents(): Promise<Admin[]> {
    // Step 1: Try to get available agents first
    let agents = await this.adminPrisma.admin.findMany({
      where: {
        role: 'SUPPORT_AGENT',
        isActive: true,
        availability: 'available',
      },
      orderBy: {
        createdAt: 'asc', // Consistent ordering for Round-Robin
      },
    });

    if (agents.length > 0) {
      this.logger.log(`[SUCCESS] Found ${agents.length} available support agents`);
      console.table(
        agents.map((a) => ({
          id: a.id,
          email: a.email,
          availability: a.availability,
          isActive: a.isActive,
          activeTicketCount: a.activeTicketCount,
        })),
      );
      return agents;
    }

    // Step 2: Fallback to all active SUPPORT_AGENT users
    agents = await this.adminPrisma.admin.findMany({
      where: {
        role: 'SUPPORT_AGENT',
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (agents.length > 0) {
      this.logger.warn(
        `[WARNING] FALLBACK: No 'available' agents, querying all active SUPPORT_AGENT users`,
      );
      console.table(
        agents.map((a) => ({
          id: a.id,
          email: a.email,
          availability: a.availability,
          isActive: a.isActive,
          activeTicketCount: a.activeTicketCount,
        })),
      );
      this.logger.warn(
        `[TIP] Run 'pnpm db:seed' in packages/db-unlisted-stox to create test agents`,
      );
      return agents;
    }

    this.logger.error(
      `[ERROR] CRITICAL: No active SUPPORT_AGENT users found in database`,
    );
    this.logger.error(`[INFO] Troubleshooting:`);
    this.logger.error(
      `1. Verify ADMIN_DATABASE_URL is set in .env (should point to unlisted_stox_db)`,
    );
    this.logger.error(`2. Run: cd packages/db-unlisted-stox && pnpm db:seed`);
    this.logger.error(`3. Check AdminPrismaService connection logs on startup`);
    this.logger.error(
      `4. Verify agents exist: SELECT * FROM "Admin" WHERE role='SUPPORT_AGENT' AND "isActive"=true;`,
    );
    return [];
  }

  /**
   * Assign ticket using Round-Robin strategy, now uses fallback logic via getAvailableAgents()
   * @param ticketId - ID of ticket to assign
   * @returns Assigned ticket or null if no agents available
   */
  private async assignTicketRoundRobin(
    ticketId: string,
  ): Promise<Ticket | null> {
    const agents = await this.getAvailableAgents();

    if (agents.length === 0) {
      this.logger.warn(
        `[WARNING] No available agents found for Round-Robin assignment of ticket ${ticketId}`,
      );
      return null;
    }

    const lastIndex = this.lastAssignedAgentIndex.get('round-robin') ?? -1;
    const nextIndex = (lastIndex + 1) % agents.length;
    const selectedAgent = agents[nextIndex];

    // Update Round-Robin state
    this.lastAssignedAgentIndex.set('round-robin', nextIndex);

    this.logger.log(
      `[INFO] Selected agent details: { id: ${selectedAgent.id}, email: ${selectedAgent.email}, availability: ${selectedAgent.availability}, activeTicketCount: ${selectedAgent.activeTicketCount} }`,
    );

    if (selectedAgent.availability === 'available') {
      this.logger.log(
        `[PROCESSING] Round-Robin: Assigned ticket ${ticketId} to available agent ${selectedAgent.id} (${selectedAgent.email}) at index ${nextIndex}`,
      );
    } else {
      this.logger.warn(
        `[WARNING] Round-Robin: Assigned ticket ${ticketId} to ${selectedAgent.availability} agent ${selectedAgent.id} (${selectedAgent.email}) at index ${nextIndex} (no available agents found)`,
      );
    }

    return await this.assignTicket(ticketId, selectedAgent.id, 'system');
  }

  /**
   * Assign ticket using workload-based strategy, with fallback to all active agents if none available
   * @param ticketId - ID of ticket to assign
   * @returns Assigned ticket or null if no agents available
   */
  private async assignTicketByWorkload(
    ticketId: string,
  ): Promise<Ticket | null> {
    // Step 1: Try to get the least busy available agent
    let agent = await this.adminPrisma.admin.findFirst({
      where: {
        role: 'SUPPORT_AGENT',
        isActive: true,
        availability: 'available',
      },
      orderBy: [
        { activeTicketCount: 'asc' }, // Lowest workload first
        { createdAt: 'asc' }, // Tie-breaker for consistency
      ],
    });

    if (agent) {
      this.logger.log(
        `[INFO] Selected least busy available agent: { id: ${agent.id}, email: ${agent.email}, activeTicketCount: ${agent.activeTicketCount}, availability: ${agent.availability} }`,
      );
      this.logger.log(
        `[INFO] Workload: Assigned ticket ${ticketId} to available agent ${agent.id} (${agent.email}) with ${agent.activeTicketCount} active tickets`,
      );
      return await this.assignTicket(ticketId, agent.id, 'system');
    }

    // Step 2: Fallback to least busy active agent
    agent = await this.adminPrisma.admin.findFirst({
      where: {
        role: 'SUPPORT_AGENT',
        isActive: true,
      },
      orderBy: [{ activeTicketCount: 'asc' }, { createdAt: 'asc' }],
    });

    if (agent) {
      this.logger.log(
        `[INFO] FALLBACK: Selected least busy active agent: { id: ${agent.id}, email: ${agent.email}, activeTicketCount: ${agent.activeTicketCount}, availability: ${agent.availability} }`,
      );
      this.logger.warn(
        `[WARNING] Workload: No available agents, assigned ticket ${ticketId} to least busy agent ${agent.id} (${agent.email}, status: ${agent.availability}) with ${agent.activeTicketCount} active tickets`,
      );
      return await this.assignTicket(ticketId, agent.id, 'system');
    }

    this.logger.warn(
      `[WARNING] No active agents found for workload-based assignment of ticket ${ticketId}`,
    );
    return null;
  }

  /**
   * Increment agent's active ticket count
   * @param agentId - ID of agent
   */
  private async incrementAgentTicketCount(agentId: string): Promise<void> {
    await this.adminPrisma.admin.update({
      where: { id: agentId },
      data: {
        activeTicketCount: {
          increment: 1,
        },
      },
    });

    this.logger.log(`[INFO] Incremented active ticket count for agent ${agentId}`);
  }

  /**
   * Decrement agent's active ticket count
   * @param agentId - ID of agent
   */
  private async decrementAgentTicketCount(agentId: string): Promise<void> {
    const result = await this.adminPrisma.admin.updateMany({
      where: {
        id: agentId,
        activeTicketCount: {
          gt: 0,
        },
      },
      data: {
        activeTicketCount: {
          decrement: 1,
        },
      },
    });

    if (result.count === 0) {
      this.logger.warn(
        `[WARNING] Cannot decrement count for agent ${agentId}: count already at 0 or agent not found`,
      );
      return;
    }

    this.logger.log(`[INFO] Decremented active ticket count for agent ${agentId}`);
  }
}
