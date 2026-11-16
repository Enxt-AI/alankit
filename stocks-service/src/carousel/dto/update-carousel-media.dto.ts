import { PartialType } from '@nestjs/mapped-types';
import { CreateCarouselMediaDto } from './create-carousel-media.dto';

export class UpdateCarouselMediaDto extends PartialType(CreateCarouselMediaDto) {}
