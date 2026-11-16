import { IsIn } from 'class-validator';

/**
 * DTO for updating lead status
 */
export class UpdateLeadStatusDto {
  /**
   * New status for the lead
   */
  @IsIn(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'])
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
}
