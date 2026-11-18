'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Headphones } from 'lucide-react';
import { SupportAgent } from '@/types/admin';

interface TicketAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketIds: string[];
  agents: SupportAgent[];
  onConfirm: (agentId: string) => Promise<void>;
}

/**
 * Ticket Assignment Dialog Component
 *
 * Allows bulk assignment of tickets to support agents with workload warnings
 */
export function TicketAssignmentDialog({
  open,
  onOpenChange,
  ticketIds,
  agents,
  onConfirm,
}: TicketAssignmentDialogProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  const selectedAgent = agents.find(agent => agent.id === selectedAgentId);

  console.log('Agents for assignment:', agents.length, 'total');

  // Helper function for availability badge
  const getAvailabilityBadge = (availability?: string) => {
    switch (availability) {
      case 'available':
        return <Badge variant="default">Available</Badge>;
      case 'busy':
        return <Badge variant="secondary">Busy</Badge>;
      case 'unavailable':
        return <Badge variant="destructive">Unavailable</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleConfirm = async () => {
    if (!selectedAgentId) return;

    setIsAssigning(true);
    try {
      await onConfirm(selectedAgentId);
      setSelectedAgentId('');
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedAgentId('');
    }
    onOpenChange(newOpen);
  };

  const hasHighWorkloadAgent = selectedAgent && (selectedAgent.activeTicketCount || 0) > 15;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Assign Tickets</AlertDialogTitle>
          <AlertDialogDescription>
            Assign {ticketIds.length} ticket{ticketIds.length > 1 ? 's' : ''} to a support agent.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Agent Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Support Agent</label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <Headphones className="h-3 w-3" />
                      <span>{agent.fullName}</span>
                      {getAvailabilityBadge(agent.availability)}
                      <span className="text-xs text-muted-foreground">({agent.email})</span>
                    </div>
                  </SelectItem>
                ))}
                {agents.length === 0 && (
                  <SelectItem value="none" disabled>
                    No support agents found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Agent Details */}
          {selectedAgent && (
            <div className="space-y-3 p-3 bg-muted rounded-md">
              <div className="flex items-center justify-between">
                <span className="font-medium">{selectedAgent.fullName}</span>
                {getAvailabilityBadge(selectedAgent.availability)}
              </div>

              <div className="text-sm text-muted-foreground">
                <div>Active Tickets: {selectedAgent.activeTicketCount || 0}</div>
                {selectedAgent.availabilityNote && (
                  <div>Note: {selectedAgent.availabilityNote}</div>
                )}
              </div>
            </div>
          )}

          {/* Workload Warning */}
          {hasHighWorkloadAgent && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                ⚠️ High workload: Agent has {(selectedAgent?.activeTicketCount || 0)} active tickets.
                Consider assigning to another agent.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isAssigning}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!selectedAgentId || isAssigning}
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              `Assign to ${selectedAgent?.fullName || 'Agent'}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}