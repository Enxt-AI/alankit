export interface Ticket {
  id: string;
  ticketNumber?: string | null;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  source: string | null;
  createdBy: string;
  assignedTo: string | null;
  assignedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  dueDate?: string; // ISO date string for ticket due date
  escalatedAt?: string; // ISO date string when ticket was escalated
  escalatedTo?: string; // Admin ID who the ticket was escalated to
  resolvedAt?: string; // ISO date string when ticket was resolved
  resolvedBy?: string; // Admin ID who resolved the ticket
  closedAt?: string; // ISO date string when ticket was closed
  rating?: number; // Rating from 1-5 given by user after resolution
  feedback?: string; // User feedback text after resolution
  reopenCount?: number; // Number of times ticket has been reopened
  comments?: Comment[];
  labels?: Label[];
  attachments?: Attachment[];
}

export interface Comment {
  id: string;
  content: string;
  userId: string;
  isInternal: boolean;
  ticketId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  uploadedBy: string;
  ticketId: string;
  createdAt: string;
}

export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed' | 'blocked' | 'escalated';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';