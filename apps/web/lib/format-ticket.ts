/**
 * Format a ticket as a human-readable series (e.g. TKT-10001).
 * Guaranteed to NEVER expose raw database CUIDs (e.g. cmtkyvgk...).
 */
export function formatTicketId(
  ticket?: { ticketNumber?: string | null; id?: string } | null,
  fallbackId?: string
): string {
  if (ticket?.ticketNumber && typeof ticket.ticketNumber === 'string') {
    const trimmed = ticket.ticketNumber.trim();
    if (trimmed) {
      return trimmed.startsWith('TKT-') ? trimmed : `TKT-${trimmed}`;
    }
  }
  const id = (ticket?.id || fallbackId || '').trim();
  if (!id) return 'TKT-10001';

  // If already formatted with series prefix
  if (id.startsWith('TKT-')) return id;

  // Compute a clean 5-digit number series from the ID so that cuid is never displayed
  const hash =
    Math.abs(
      id.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0)
    ) % 90000 + 10001;
  return `TKT-${hash}`;
}
