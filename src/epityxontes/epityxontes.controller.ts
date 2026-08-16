import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { EpityxontesService } from './epityxontes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateGraduateDto } from './dto/create-graduate.dto';
import { UpdateGraduateDto } from './dto/update-graduate.dto';
import { ImportGraduatesDto } from './dto/import-graduates.dto';
import { GraduateQueryDto } from './dto/graduate-query.dto';
import { AdminRequest } from '../common/interfaces/request.interface';

/**
 * Οι επιτυχόντες του φροντιστηρίου.
 *
 * Διάβασμα ανοιχτό (τα τροφοδοτεί το public /epityxontes), γράψιμο μόνο από
 * διαχειριστή. Τα literal routes δηλώνονται πριν από τα `:id` ώστε το
 * `/year/2025` να μην περάσει ποτέ για ObjectId.
 */
@Controller('api/epityxontes')
export class EpityxontesController {
  constructor(private readonly epityxontesService: EpityxontesService) {}

  @Get('years')
  async findYears() {
    return this.epityxontesService.findYears();
  }

  @Get('year/:startYear')
  async findByYear(@Param('startYear', ParseIntPipe) startYear: number) {
    return this.epityxontesService.findByYear(startYear);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.epityxontesService.findBySlug(slug);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll(@Query() query: GraduateQueryDto) {
    return this.epityxontesService.findAll(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() dto: CreateGraduateDto, @Request() req: AdminRequest) {
    return this.epityxontesService.create(dto, req.admin!.id);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async import(@Body() dto: ImportGraduatesDto, @Request() req: AdminRequest) {
    return this.epityxontesService.import(dto, req.admin!.id);
  }

  @Delete('year/:startYear')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async removeYear(@Param('startYear', ParseIntPipe) startYear: number) {
    return this.epityxontesService.removeYear(startYear);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGraduateDto,
    @Request() req: AdminRequest,
  ) {
    return this.epityxontesService.update(id, dto, req.admin!.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    return this.epityxontesService.remove(id);
  }
}
