import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('hr')
@UseGuards(JwtAuthGuard)
export class HrController {
  constructor(private readonly service: HrService) {}

  // Employees
  @Get('employees')
  async getEmployees(@CurrentUser() user: CurrentUserData, @Query() query: any) {
    return this.service.getEmployees(user.businessId, query);
  }

  @Get('employees/:id')
  async getEmployee(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const data = await this.service.getEmployeeById(user.businessId, id);
    return { data };
  }

  @Post('employees')
  async createEmployee(@CurrentUser() user: CurrentUserData, @Body() dto: any) {
    const data = await this.service.createEmployee(user.businessId, dto);
    return { data };
  }

  @Patch('employees/:id')
  async updateEmployee(@CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: any) {
    const data = await this.service.updateEmployee(user.businessId, id, dto);
    return { data };
  }

  @Delete('employees/:id')
  async deleteEmployee(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.service.deleteEmployee(user.businessId, id);
  }

  // Payroll
  @Post('payroll/generate')
  async generatePayroll(@CurrentUser() user: CurrentUserData, @Body() body: { period: string }) {
    const data = await this.service.generatePayroll(user.businessId, body.period);
    return { data };
  }

  @Get('payroll')
  async getPayroll(@CurrentUser() user: CurrentUserData, @Query('period') period: string) {
    const data = await this.service.getPayrollByPeriod(user.businessId, period);
    return { data };
  }

  @Post('payroll/:id/approve')
  async approvePayroll(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const data = await this.service.approvePayroll(user.businessId, id);
    return { data };
  }

  @Post('payroll/:id/pay')
  async markPaid(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const data = await this.service.markPayrollPaid(user.businessId, id);
    return { data };
  }

  // Attendance
  @Post('attendance')
  async recordAttendance(@CurrentUser() user: CurrentUserData, @Body() dto: any) {
    const data = await this.service.recordAttendance(user.businessId, dto);
    return { data };
  }

  @Get('attendance')
  async getAttendance(@CurrentUser() user: CurrentUserData, @Query() query: any) {
    const data = await this.service.getAttendanceReport(user.businessId, query);
    return { data };
  }
}
