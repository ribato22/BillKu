import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

// BigInt JSON serialization (Prisma returns BigInt for monetary fields)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Use express body parser with increased limit for logo uploads (base64)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bodyParser = require('body-parser');
  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

  // Cookie parser for refresh tokens
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Health check endpoint (outside global prefix for Docker healthcheck)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Swagger/OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('BillKu API')
    .setDescription('API dokumentasi untuk BillKu - Aplikasi Billing & Piutang UMKM Indonesia')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autentikasi & Otorisasi')
    .addTag('business', 'Profil Bisnis')
    .addTag('customers', 'Manajemen Pelanggan')
    .addTag('products', 'Manajemen Produk')
    .addTag('invoices', 'Manajemen Invoice')
    .addTag('payments', 'Pembayaran')
    .addTag('quotations', 'Penawaran / Proforma')
    .addTag('expenses', 'Pengeluaran')
    .addTag('delivery-notes', 'Surat Jalan')
    .addTag('reports', 'Laporan')
    .addTag('audit-logs', 'Audit Trail')
    .addTag('whatsapp', 'WhatsApp Integration')
    .addTag('recurring', 'Invoice Berulang')
    .addTag('sales-orders', 'Sales Order / Pesanan Penjualan')
    .addTag('credit-notes', 'Credit Note / Nota Kredit')
    .addTag('purchase-orders', 'Purchase Order / Pesanan Pembelian')
    .addTag('tax', 'Pajak & e-Faktur')
    .addTag('crm', 'CRM: Deals Pipeline & Activities')
    .addTag('pos', 'Point of Sale / Kasir')
    .addTag('hr', 'HR: Karyawan, Payroll & Absensi')
    .addTag('meterai', 'e-Meterai Digital (PERURI)')
    .addTag('marketplace', 'Marketplace Integration (Tokopedia/Shopee)')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS with credentials support (including Docker container networking)
  const corsOrigins = [
    'http://localhost:3002',
    'http://localhost:4001',
    'http://localhost:4000',
    'http://127.0.0.1:4001',
    'http://127.0.0.1:3002',
    // Docker container networking
    'http://billku-frontend:4001',
    'http://frontend:4001',
  ];
  
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
