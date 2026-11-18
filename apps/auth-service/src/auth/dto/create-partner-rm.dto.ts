import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CreateRmDto } from './create-rm.dto';

export class CreatePartnerRmDto extends CreateRmDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString({ message: 'Employee ID must be a string' })
  @IsNotEmpty({ message: 'Employee ID is required' })
  @MaxLength(100, { message: 'Employee ID must be at most 100 characters' })
  employeeId: string;
}
