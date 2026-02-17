import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HrService {
  constructor(private prisma: PrismaService) {}

  // ======================== EMPLOYEES ========================

  async getEmployees(businessId: string, query: { status?: string; department?: string; page?: number; limit?: number } = {}) {
    const { status, department, page = 1, limit = 20 } = query;
    const where: any = { businessId };
    if (status) where.status = status;
    if (department) where.department = department;

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: data.map((e) => ({ ...e, baseSalary: Number(e.baseSalary) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getEmployeeById(businessId: string, id: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, businessId },
      include: { payrolls: { orderBy: { period: 'desc' }, take: 12 }, attendances: { orderBy: { date: 'desc' }, take: 30 } },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    return {
      ...emp,
      baseSalary: Number(emp.baseSalary),
      payrolls: emp.payrolls.map((p) => this.serializePayroll(p)),
    };
  }

  async createEmployee(businessId: string, dto: any) {
    // Auto-generate employeeId if not provided
    let employeeId = dto.employeeId;
    if (!employeeId) {
      const count = await this.prisma.employee.count({ where: { businessId } });
      employeeId = `EMP-${String(count + 1).padStart(3, '0')}`;
    }

    const existing = await this.prisma.employee.findFirst({ where: { businessId, employeeId } });
    if (existing) throw new BadRequestException(`Employee ID ${employeeId} already exists`);

    const emp = await this.prisma.employee.create({
      data: {
        businessId,
        employeeId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        position: dto.position,
        department: dto.department,
        joinDate: dto.joinDate ? new Date(dto.joinDate) : new Date(),
        baseSalary: dto.baseSalary ? BigInt(dto.baseSalary) : BigInt(0),
        bankName: dto.bankName,
        bankAccount: dto.bankAccount,
        npwp: dto.npwp,
        bpjsKes: dto.bpjsKes,
        bpjsTk: dto.bpjsTk,
      },
    });
    return { ...emp, baseSalary: Number(emp.baseSalary) };
  }

  async updateEmployee(businessId: string, id: string, dto: any) {
    const existing = await this.prisma.employee.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Employee not found');

    const data: any = {};
    const fields = ['name', 'email', 'phone', 'position', 'department', 'status', 'bankName', 'bankAccount', 'npwp', 'bpjsKes', 'bpjsTk'];
    fields.forEach((f) => { if (dto[f] !== undefined) data[f] = dto[f]; });
    if (dto.baseSalary !== undefined) data.baseSalary = BigInt(dto.baseSalary);
    if (dto.joinDate) data.joinDate = new Date(dto.joinDate);

    const emp = await this.prisma.employee.update({ where: { id }, data });
    return { ...emp, baseSalary: Number(emp.baseSalary) };
  }

  async deleteEmployee(businessId: string, id: string) {
    const existing = await this.prisma.employee.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Employee not found');
    await this.prisma.employee.delete({ where: { id } });
    return { message: 'Employee deleted' };
  }

  // ======================== PAYROLL ========================

  async generatePayroll(businessId: string, period: string) {
    // period format "2026-02"
    const employees = await this.prisma.employee.findMany({ where: { businessId, status: 'active' } });
    if (employees.length === 0) throw new BadRequestException('No active employees found');

    const payrolls = [];
    for (const emp of employees) {
      // Check if already exists
      const existing = await this.prisma.payroll.findFirst({ where: { businessId, employeeId: emp.id, period } });
      if (existing) {
        payrolls.push(existing);
        continue;
      }

      const baseSalary = emp.baseSalary;
      // BPJS Kesehatan: Employee 1%, Company 4% (cap UMP)
      const bpjsKesEmployee = (baseSalary * BigInt(1)) / BigInt(100);
      const bpjsKesCompany = (baseSalary * BigInt(4)) / BigInt(100);
      // BPJS TK — JHT: Employee 2%, Company 3.7%
      const bpjsTkEmployee = (baseSalary * BigInt(2)) / BigInt(100);
      const bpjsTkCompany = (baseSalary * BigInt(37)) / BigInt(1000);
      // Simplified PPh21 (progressive rate, simplified annual/12)
      const annualGross = Number(baseSalary) * 12;
      let pph21Annual = 0;
      if (annualGross > 500_000_000) pph21Annual = (annualGross - 500_000_000) * 0.30 + 95_000_000;
      else if (annualGross > 250_000_000) pph21Annual = (annualGross - 250_000_000) * 0.25 + 32_500_000;
      else if (annualGross > 60_000_000) pph21Annual = (annualGross - 60_000_000) * 0.15 + 2_500_000;
      else pph21Annual = annualGross * 0.05;
      const pph21 = BigInt(Math.round(pph21Annual / 12));

      const netSalary = baseSalary - bpjsKesEmployee - bpjsTkEmployee - pph21;

      const payroll = await this.prisma.payroll.create({
        data: {
          businessId,
          employeeId: emp.id,
          period,
          baseSalary,
          bpjsKesEmployee,
          bpjsKesCompany,
          bpjsTkEmployee,
          bpjsTkCompany,
          pph21,
          netSalary,
        },
        include: { employee: { select: { id: true, name: true, employeeId: true, position: true } } },
      });
      payrolls.push(payroll);
    }

    return {
      period,
      totalEmployees: payrolls.length,
      totalNetSalary: payrolls.reduce((s, p) => s + Number(p.netSalary), 0),
      payrolls: payrolls.map((p) => this.serializePayroll(p)),
    };
  }

  async getPayrollByPeriod(businessId: string, period: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: { businessId, period },
      include: { employee: { select: { id: true, name: true, employeeId: true, position: true, department: true } } },
      orderBy: { employee: { name: 'asc' } },
    });

    return {
      period,
      totalEmployees: payrolls.length,
      totalGross: payrolls.reduce((s, p) => s + Number(p.baseSalary) + Number(p.allowances) + Number(p.overtime), 0),
      totalDeductions: payrolls.reduce((s, p) => s + Number(p.bpjsKesEmployee) + Number(p.bpjsTkEmployee) + Number(p.pph21) + Number(p.deductions), 0),
      totalNet: payrolls.reduce((s, p) => s + Number(p.netSalary), 0),
      payrolls: payrolls.map((p) => this.serializePayroll(p)),
    };
  }

  async approvePayroll(businessId: string, id: string) {
    const payroll = await this.prisma.payroll.findFirst({ where: { id, businessId } });
    if (!payroll) throw new NotFoundException('Payroll not found');
    if (payroll.status !== 'draft') throw new BadRequestException('Payroll is not in draft status');
    const updated = await this.prisma.payroll.update({ where: { id }, data: { status: 'approved' } });
    return this.serializePayroll(updated);
  }

  async markPayrollPaid(businessId: string, id: string) {
    const payroll = await this.prisma.payroll.findFirst({ where: { id, businessId } });
    if (!payroll) throw new NotFoundException('Payroll not found');
    if (payroll.status !== 'approved') throw new BadRequestException('Payroll must be approved first');
    const updated = await this.prisma.payroll.update({ where: { id }, data: { status: 'paid', paidAt: new Date() } });
    return this.serializePayroll(updated);
  }

  // ======================== ATTENDANCE ========================

  async recordAttendance(businessId: string, dto: { employeeId: string; date: string; status?: string; clockIn?: string; clockOut?: string; notes?: string }) {
    const date = new Date(dto.date);
    return this.prisma.attendance.upsert({
      where: { businessId_employeeId_date: { businessId, employeeId: dto.employeeId, date } },
      create: {
        businessId,
        employeeId: dto.employeeId,
        date,
        status: (dto.status as any) || 'present',
        clockIn: dto.clockIn ? new Date(dto.clockIn) : null,
        clockOut: dto.clockOut ? new Date(dto.clockOut) : null,
        notes: dto.notes,
      },
      update: {
        status: (dto.status as any) || 'present',
        clockIn: dto.clockIn ? new Date(dto.clockIn) : undefined,
        clockOut: dto.clockOut ? new Date(dto.clockOut) : undefined,
        notes: dto.notes,
      },
      include: { employee: { select: { id: true, name: true, employeeId: true } } },
    });
  }

  async getAttendanceReport(businessId: string, query: { month?: string; employeeId?: string }) {
    const where: any = { businessId };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.month) {
      const [year, month] = query.month.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
    }

    const records = await this.prisma.attendance.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeId: true, department: true } } },
      orderBy: [{ employee: { name: 'asc' } }, { date: 'asc' }],
    });

    // Summarize by employee
    const summary = new Map<string, any>();
    records.forEach((r) => {
      const key = r.employeeId;
      if (!summary.has(key)) {
        summary.set(key, { employee: r.employee, present: 0, absent: 0, late: 0, leave: 0, sick: 0, half_day: 0, total: 0 });
      }
      const s = summary.get(key);
      s[r.status] = (s[r.status] || 0) + 1;
      s.total++;
    });

    return { records, summary: Array.from(summary.values()) };
  }

  // ======================== HELPERS ========================

  private serializePayroll(p: any) {
    return {
      ...p,
      baseSalary: Number(p.baseSalary),
      allowances: Number(p.allowances),
      overtime: Number(p.overtime),
      deductions: Number(p.deductions),
      bpjsKesEmployee: Number(p.bpjsKesEmployee),
      bpjsKesCompany: Number(p.bpjsKesCompany),
      bpjsTkEmployee: Number(p.bpjsTkEmployee),
      bpjsTkCompany: Number(p.bpjsTkCompany),
      pph21: Number(p.pph21),
      netSalary: Number(p.netSalary),
    };
  }
}
