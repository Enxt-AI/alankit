import { PartialType } from '@nestjs/mapped-types';
import { CreateBasketDto } from './create-basket.dto';

/**
 * DTO for updating an existing stock basket
 * All fields from CreateBasketDto are optional via PartialType
 */
export class UpdateBasketDto extends PartialType(CreateBasketDto) {}
