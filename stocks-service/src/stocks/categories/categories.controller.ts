import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CmsJwtAuthGuard } from '../../auth/guards/cms-jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../auth/guards/permissions.guard';

@Controller('cms/stocks/categories')
@UseGuards(CmsJwtAuthGuard, PermissionsGuard)
@RequirePermissions('cms_stocks')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll() {
    return this.categoriesService.findAll();
  }

  // CMS writes are maker-checker: held for admin approval, nothing goes live.
  @Post()
  async create(@Body() body: { name: string; description?: string; isActive?: boolean }, @Req() req: any) {
    const changeRequest = await this.categoriesService.proposeCreate(body, req.user.adminId);
    return { message: 'Category creation submitted for admin approval', changeRequest };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; description?: string; isActive?: boolean }, @Req() req: any) {
    const changeRequest = await this.categoriesService.proposeUpdate(id, body, req.user.adminId);
    return { message: 'Category update submitted for admin approval', changeRequest };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const changeRequest = await this.categoriesService.proposeRemove(id, req.user.adminId);
    return { message: 'Category deletion submitted for admin approval', changeRequest };
  }
}
