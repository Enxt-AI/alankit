import { IsString, IsNotEmpty, IsEnum, Matches, MaxLength } from 'class-validator';
import { CreateRmDto } from './create-rm.dto';

export class AdminCreateRmDto extends CreateRmDto {
  @IsString()
  @IsNotEmpty({ message: 'Type is required' })
  @IsEnum(['INTERNAL_RM', 'DISTRIBUTOR_RM'])
  type: string;

  @IsString()
  @IsNotEmpty({ message: 'Parent ID is required' })
  @Matches(/^[a-zA-Z0-9\-]+$/, { message: 'Parent ID contains invalid characters' })
  @MaxLength(100)
  parentId: string;
}
