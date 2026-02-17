"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Plus, Star, Loader2, Eye, Pencil, Trash2, Code, Palette,
  Variable, ArrowLeft, Save, Copy, Check, Maximize2, Minimize2, Sparkles,
  Bold, Italic, Table, AlignLeft, AlignCenter, AlignRight, Type,
  Image, Link, Undo2, Redo2, Columns, LayoutTemplate
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

// Dynamically import code editor (client-only)
const CodeEditor = dynamic(() => import("react-simple-code-editor"), { ssr: false });

// Prism.js for syntax highlighting
import Prism from "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/themes/prism-tomorrow.css";

interface InvoiceTemplate {
  id: string;
  name: string;
  htmlBody: string;
  isDefault: boolean;
  createdAt: string;
}

// All available template variables
const TEMPLATE_VARIABLES = [
  { key: "{{businessName}}", label: "Nama Bisnis", category: "business" },
  { key: "{{businessLogo}}", label: "Logo Bisnis", category: "business" },
  { key: "{{businessAddress}}", label: "Alamat Bisnis", category: "business" },
  { key: "{{businessPhone}}", label: "Telepon Bisnis", category: "business" },
  { key: "{{businessEmail}}", label: "Email Bisnis", category: "business" },
  { key: "{{invoiceNumber}}", label: "No. Invoice", category: "invoice" },
  { key: "{{issueDate}}", label: "Tanggal Terbit", category: "invoice" },
  { key: "{{dueDate}}", label: "Jatuh Tempo", category: "invoice" },
  { key: "{{customerName}}", label: "Nama Pelanggan", category: "customer" },
  { key: "{{customerAddress}}", label: "Alamat Pelanggan", category: "customer" },
  { key: "{{customerEmail}}", label: "Email Pelanggan", category: "customer" },
  { key: "{{customerPhone}}", label: "Telepon Pelanggan", category: "customer" },
  { key: "{{#items}}...{{/items}}", label: "Loop Item", category: "items" },
  { key: "{{itemNumber}}", label: "Nomor Urut", category: "items" },
  { key: "{{description}}", label: "Deskripsi Item", category: "items" },
  { key: "{{qty}}", label: "Jumlah", category: "items" },
  { key: "{{unitPrice}}", label: "Harga Satuan", category: "items" },
  { key: "{{total}}", label: "Total Item", category: "items" },
  { key: "{{currencySymbol}}", label: "Simbol Mata Uang", category: "totals" },
  { key: "{{grandTotal}}", label: "Grand Total", category: "totals" },
  { key: "{{subtotal}}", label: "Subtotal", category: "totals" },
  { key: "{{taxAmount}}", label: "Pajak", category: "totals" },
  { key: "{{discount}}", label: "Diskon", category: "totals" },
  { key: "{{bankName}}", label: "Nama Bank", category: "payment" },
  { key: "{{bankAccountNumber}}", label: "No. Rekening", category: "payment" },
  { key: "{{bankAccountName}}", label: "Nama Rekening", category: "payment" },
];

const VARIABLE_CATEGORIES = [
  { id: "business", label: "Bisnis", color: "text-blue-600" },
  { id: "invoice", label: "Invoice", color: "text-green-600" },
  { id: "customer", label: "Pelanggan", color: "text-purple-600" },
  { id: "items", label: "Item", color: "text-orange-600" },
  { id: "totals", label: "Total", color: "text-teal-600" },
  { id: "payment", label: "Pembayaran", color: "text-pink-600" },
];

// Sample data for live preview
const SAMPLE_DATA: Record<string, string> = {
  "{{businessName}}": "PT Maju Bersama",
  "{{businessLogo}}": '<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTYiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA1NiA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTYiIGhlaWdodD0iNTYiIHJ4PSIxMiIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC45Ii8+PHRleHQgeD0iMjgiIHk9IjM2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzBmNzY2ZSI+TUI8L3RleHQ+PC9zdmc+" alt="Logo" style="height:56px;width:56px;object-fit:contain;border-radius:8px" />',
  "{{businessAddress}}": "Jl. Sudirman No. 123, Jakarta",
  "{{businessPhone}}": "021-5551234",
  "{{businessEmail}}": "info@majubersama.co.id",
  "{{invoiceNumber}}": "INV-2026-001",
  "{{issueDate}}": "10 Februari 2026",
  "{{dueDate}}": "10 Maret 2026",
  "{{customerName}}": "CV Sejahtera",
  "{{customerAddress}}": "Jl. Gatot Subroto No. 42, Bandung",
  "{{customerEmail}}": "admin@sejahtera.id",
  "{{customerPhone}}": "022-1234567",
  "{{currencySymbol}}": "Rp",
  "{{grandTotal}}": "5.500.000",
  "{{subtotal}}": "5.000.000",
  "{{taxAmount}}": "500.000",
  "{{discount}}": "0",
  "{{bankName}}": "BCA",
  "{{bankAccountNumber}}": "1234567890",
  "{{bankAccountName}}": "PT Maju Bersama",
};

const SAMPLE_ITEMS_HTML = `<tr><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">Jasa Konsultasi IT</td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center">2</td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right">Rp 1.500.000</td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right">Rp 3.000.000</td></tr>
<tr><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">Setup Server Cloud</td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center">1</td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right">Rp 2.000.000</td><td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right">Rp 2.000.000</td></tr>`;

// ─── Visual Config Interface (enriched) ───
interface VisualConfig {
  // Colors
  headerColor: string;
  accentColor: string;
  textColor: string;
  bgColor: string;
  tableBorderColor: string;
  // Typography
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large';
  // Header
  headerStyle: 'gradient' | 'solid' | 'minimal' | 'bordered';
  showBusinessName: boolean;
  showBusinessAddress: boolean;
  // Logo
  showLogo: boolean;
  logoPosition: 'left' | 'center' | 'right';
  logoSize: 'small' | 'medium' | 'large';
  // Layout
  borderRadius: 'none' | 'small' | 'medium' | 'large';
  tableStyle: 'modern' | 'classic' | 'striped' | 'borderless';
  spacing: 'compact' | 'normal' | 'relaxed';
  // Table options
  showItemNumbers: boolean;
  // Content toggles
  showPaymentInfo: boolean;
  showTax: boolean;
  showDiscount: boolean;
  showNotes: boolean;
  notesText: string;
  showFooter: boolean;
  footerText: string;
  // Signature
  showSignature: boolean;
  signatureLeftLabel: string;
  signatureRightLabel: string;
  // Watermark
  showWatermark: boolean;
  watermarkText: string;
  // Terms
  showTerms: boolean;
  termsText: string;
}

const DEFAULT_VISUAL: VisualConfig = {
  headerColor: '#0f766e',
  accentColor: '#14b8a6',
  textColor: '#1f2937',
  bgColor: '#ffffff',
  tableBorderColor: '#e5e7eb',
  fontFamily: "'Segoe UI', sans-serif",
  fontSize: 'medium',
  headerStyle: 'gradient',
  showBusinessName: true,
  showBusinessAddress: true,
  showLogo: true,
  logoPosition: 'right',
  logoSize: 'medium',
  borderRadius: 'medium',
  tableStyle: 'modern',
  spacing: 'normal',
  showItemNumbers: false,
  showPaymentInfo: true,
  showTax: true,
  showDiscount: true,
  showNotes: false,
  notesText: 'Terima kasih atas kepercayaan Anda.',
  showFooter: false,
  footerText: 'Dokumen ini sah tanpa tanda tangan.',
  showSignature: true,
  signatureLeftLabel: 'Penerima',
  signatureRightLabel: 'Hormat Kami,',
  showWatermark: false,
  watermarkText: 'LUNAS',
  showTerms: false,
  termsText: 'Pembayaran dilakukan dalam waktu yang ditentukan.\nKeterlambatan pembayaran akan dikenakan denda.',
};

const FONT_OPTIONS = [
  { label: 'Segoe UI (Default)', value: "'Segoe UI', sans-serif" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Roboto', value: "'Roboto', sans-serif" },
  { label: 'Arial', value: "Arial, sans-serif" },
  { label: 'Georgia (Serif)', value: "Georgia, serif" },
  { label: 'Courier New (Mono)', value: "'Courier New', monospace" },
];

const COLOR_PRESETS = [
  { name: 'Teal Pro', headerColor: '#0f766e', accentColor: '#14b8a6', textColor: '#1f2937' },
  { name: 'Ocean Blue', headerColor: '#1e40af', accentColor: '#3b82f6', textColor: '#1e293b' },
  { name: 'Royal Purple', headerColor: '#6d28d9', accentColor: '#8b5cf6', textColor: '#1e1b4b' },
  { name: 'Sunset Red', headerColor: '#b91c1c', accentColor: '#ef4444', textColor: '#1c1917' },
  { name: 'Forest Green', headerColor: '#166534', accentColor: '#22c55e', textColor: '#14532d' },
  { name: 'Slate Dark', headerColor: '#334155', accentColor: '#64748b', textColor: '#0f172a' },
  { name: 'Amber Warm', headerColor: '#b45309', accentColor: '#f59e0b', textColor: '#292524' },
  { name: 'Rose Pink', headerColor: '#be185d', accentColor: '#f472b6', textColor: '#1c1917' },
];

// HTML snippets for editor toolbar
const HTML_SNIPPETS = [
  { label: 'Heading', icon: Type, html: '<h2 style="margin:0;font-size:20px;font-weight:700">Heading</h2>\n' },
  { label: 'Bold', icon: Bold, html: '<strong>teks tebal</strong>' },
  { label: 'Italic', icon: Italic, html: '<em>teks miring</em>' },
  { label: 'Tabel', icon: Table, html: `<table style="width:100%;border-collapse:collapse">\n  <thead>\n    <tr style="background:#f3f4f6">\n      <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">Kolom 1</th>\n      <th style="padding:8px;text-align:right;border-bottom:2px solid #e5e7eb">Kolom 2</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td style="padding:8px;border-bottom:1px solid #f3f4f6">Data 1</td>\n      <td style="padding:8px;text-align:right;border-bottom:1px solid #f3f4f6">Data 2</td>\n    </tr>\n  </tbody>\n</table>\n` },
  { label: 'Gambar', icon: Image, html: '<img src="URL_GAMBAR" alt="gambar" style="max-width:200px;height:auto" />\n' },
  { label: 'Link', icon: Link, html: '<a href="https://example.com" style="color:#0f766e">Teks link</a>' },
  { label: 'Rata Kiri', icon: AlignLeft, html: '<div style="text-align:left">teks rata kiri</div>\n' },
  { label: 'Rata Tengah', icon: AlignCenter, html: '<div style="text-align:center">teks rata tengah</div>\n' },
  { label: 'Rata Kanan', icon: AlignRight, html: '<div style="text-align:right">teks rata kanan</div>\n' },
  { label: '2 Kolom', icon: Columns, html: `<div style="display:flex;gap:20px">\n  <div style="flex:1">Kolom Kiri</div>\n  <div style="flex:1">Kolom Kanan</div>\n</div>\n` },
  { label: 'Kotak Info', icon: LayoutTemplate, html: `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:10px 0">\n  <p style="font-size:12px;font-weight:600;color:#166534;margin:0 0 4px">Info</p>\n  <p style="font-size:13px;margin:0;color:#14532d">Isi konten di sini</p>\n</div>\n` },
];

function generateFromVisual(config: VisualConfig): string {
  const radius = { none: '0', small: '6px', medium: '12px', large: '20px' }[config.borderRadius];
  const pad = { compact: '24px', normal: '40px', relaxed: '56px' }[config.spacing];
  const headerPad = { compact: '20px', normal: '30px', relaxed: '40px' }[config.spacing];
  const fontSizeBase = { small: '12px', medium: '14px', large: '16px' }[config.fontSize];
  const fontSizeTitle = { small: '22px', medium: '28px', large: '34px' }[config.fontSize];
  const fontSizeSmall = { small: '10px', medium: '12px', large: '14px' }[config.fontSize];
  const logoSizePx = { small: '40px', medium: '56px', large: '80px' }[config.logoSize];

  // Header background
  const headerBg = config.headerStyle === 'gradient'
    ? `background:linear-gradient(135deg,${config.headerColor} 0%,${config.accentColor} 100%);color:white`
    : config.headerStyle === 'solid'
    ? `background:${config.headerColor};color:white`
    : config.headerStyle === 'bordered'
    ? `background:transparent;border:3px solid ${config.headerColor};color:${config.headerColor}`
    : `background:transparent;border-bottom:3px solid ${config.headerColor};color:${config.headerColor}`;

  // Table header style
  const thBg = config.tableStyle === 'modern' ? `${config.headerColor}10` :
               config.tableStyle === 'classic' ? config.headerColor :
               config.tableStyle === 'striped' ? '#f9fafb' : 'transparent';
  const thTextColor = config.tableStyle === 'classic' ? 'white' : config.headerColor;
  const thBorder = config.tableStyle === 'borderless' ? 'none' : `2px solid ${config.headerColor}20`;
  const tdBorder = config.tableStyle === 'borderless' ? 'none' : `1px solid ${config.tableBorderColor}`;

  // Striped rows
  const trEven = config.tableStyle === 'striped' ? `background:#f9fafb` : '';

  // Logo HTML
  const logoImgTag = `<div style="display:inline-block;height:${logoSizePx};width:${logoSizePx};overflow:hidden;border-radius:8px;background:rgba(255,255,255,0.15)">{{businessLogo}}</div>`;

  // Build header content based on logo position
  let headerContent = '';
  if (config.showLogo && config.logoPosition === 'center') {
    // Logo centered above title
    headerContent = `<div style="text-align:center">
      ${logoImgTag}
      ${config.showBusinessName ? `<p style="margin:8px 0 2px 0;font-size:${fontSizeSmall};opacity:0.85;text-transform:uppercase;letter-spacing:1px">{{businessName}}</p>` : ''}
      <h1 style="margin:0;font-size:${fontSizeTitle};font-weight:700">INVOICE #{{invoiceNumber}}</h1>
      ${config.showBusinessAddress ? `<p style="margin:6px 0 0 0;opacity:0.9;font-size:${fontSizeSmall}">{{businessAddress}} | {{businessPhone}}</p>` : ''}
    </div>`;
  } else if (config.showLogo && config.logoPosition === 'left') {
    // Logo on left, text on right
    headerContent = `<table style="width:100%"><tr>
      <td style="vertical-align:middle;width:${logoSizePx}">${logoImgTag}</td>
      <td style="vertical-align:middle;padding-left:16px">
        ${config.showBusinessName ? `<p style="margin:0 0 2px 0;font-size:${fontSizeSmall};opacity:0.85;text-transform:uppercase;letter-spacing:1px">{{businessName}}</p>` : ''}
        <h1 style="margin:0;font-size:${fontSizeTitle};font-weight:700">INVOICE #{{invoiceNumber}}</h1>
        ${config.showBusinessAddress ? `<p style="margin:6px 0 0 0;opacity:0.9;font-size:${fontSizeSmall}">{{businessAddress}} | {{businessPhone}}</p>` : ''}
      </td>
    </tr></table>`;
  } else {
    // Logo on right (default) or no logo
    headerContent = `<table style="width:100%"><tr>
      <td style="vertical-align:middle">
        ${config.showBusinessName ? `<p style="margin:0 0 2px 0;font-size:${fontSizeSmall};opacity:0.85;text-transform:uppercase;letter-spacing:1px">{{businessName}}</p>` : ''}
        <h1 style="margin:0;font-size:${fontSizeTitle};font-weight:700">INVOICE #{{invoiceNumber}}</h1>
        ${config.showBusinessAddress ? `<p style="margin:6px 0 0 0;opacity:0.9;font-size:${fontSizeSmall}">{{businessAddress}} | {{businessPhone}}</p>` : ''}
      </td>
      ${config.showLogo ? `<td style="text-align:right;vertical-align:middle">${logoImgTag}</td>` : ''}
    </tr></table>`;
  }

  // Item number column
  const itemNumTh = config.showItemNumbers ? `<th style="text-align:center;padding:10px 8px;font-size:${fontSizeSmall};text-transform:uppercase;letter-spacing:0.5px;color:${thTextColor};border-bottom:${thBorder};width:40px">No</th>` : '';
  const itemNumTd = config.showItemNumbers ? `<td style="padding:10px 8px;border-bottom:${tdBorder};text-align:center;color:#6b7280">{{itemNumber}}</td>` : '';

  return `<div style="font-family:${config.fontFamily};max-width:800px;margin:0 auto;padding:${pad};color:${config.textColor};font-size:${fontSizeBase};background:${config.bgColor};position:relative">
  ${config.showWatermark ? `<!-- WATERMARK -->
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:100px;font-weight:900;opacity:0.04;color:${config.headerColor};pointer-events:none;white-space:nowrap;letter-spacing:10px;z-index:0">${config.watermarkText}</div>` : ''}

  <!-- HEADER -->
  <div style="${headerBg};padding:${headerPad};border-radius:${radius};margin-bottom:${pad};position:relative;z-index:1">
    ${headerContent}
  </div>

  <!-- CUSTOMER & DETAIL -->
  <div style="display:flex;justify-content:space-between;margin-bottom:${pad};position:relative;z-index:1">
    <div>
      <p style="color:#6b7280;font-size:${fontSizeSmall};text-transform:uppercase;letter-spacing:1px;margin:0 0 6px 0">Kepada</p>
      <p style="font-size:${fontSizeBase};font-weight:600;margin:0">{{customerName}}</p>
      <p style="color:#6b7280;font-size:${fontSizeSmall};margin:4px 0 0 0">{{customerAddress}}</p>
    </div>
    <div style="text-align:right">
      <p style="color:#6b7280;font-size:${fontSizeSmall};text-transform:uppercase;letter-spacing:1px;margin:0 0 6px 0">Detail</p>
      <p style="font-size:${fontSizeSmall};margin:0"><strong>Tanggal:</strong> {{issueDate}}</p>
      <p style="font-size:${fontSizeSmall};margin:4px 0 0 0"><strong>Jatuh Tempo:</strong> {{dueDate}}</p>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:${pad};position:relative;z-index:1">
    <thead>
      <tr style="background:${thBg}">
        ${itemNumTh}
        <th style="text-align:left;padding:10px 12px;font-size:${fontSizeSmall};text-transform:uppercase;letter-spacing:0.5px;color:${thTextColor};border-bottom:${thBorder}">Deskripsi</th>
        <th style="text-align:center;padding:10px 12px;font-size:${fontSizeSmall};text-transform:uppercase;letter-spacing:0.5px;color:${thTextColor};border-bottom:${thBorder};width:60px">Qty</th>
        <th style="text-align:right;padding:10px 12px;font-size:${fontSizeSmall};text-transform:uppercase;letter-spacing:0.5px;color:${thTextColor};border-bottom:${thBorder}">Harga</th>
        <th style="text-align:right;padding:10px 12px;font-size:${fontSizeSmall};text-transform:uppercase;letter-spacing:0.5px;color:${thTextColor};border-bottom:${thBorder}">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr${trEven ? ` style="${trEven}"` : ''}>
        ${itemNumTd}
        <td style="padding:10px 12px;border-bottom:${tdBorder}">{{description}}</td>
        <td style="padding:10px 12px;border-bottom:${tdBorder};text-align:center">{{qty}}</td>
        <td style="padding:10px 12px;border-bottom:${tdBorder};text-align:right">{{currencySymbol}} {{unitPrice}}</td>
        <td style="padding:10px 12px;border-bottom:${tdBorder};text-align:right">{{currencySymbol}} {{total}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <!-- TOTALS -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:${pad};position:relative;z-index:1">
    <div style="width:280px">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:${fontSizeSmall}">
        <span style="color:#6b7280">Subtotal</span>
        <span>{{currencySymbol}} {{subtotal}}</span>
      </div>
      ${config.showDiscount ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:${fontSizeSmall}">
        <span style="color:#6b7280">Diskon</span>
        <span>- {{currencySymbol}} {{discount}}</span>
      </div>` : ''}
      ${config.showTax ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:${fontSizeSmall}">
        <span style="color:#6b7280">Pajak (PPN)</span>
        <span>{{currencySymbol}} {{taxAmount}}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:18px;font-weight:700;border-top:2px solid ${config.headerColor};margin-top:8px">
        <span>Total</span>
        <span style="color:${config.headerColor}">{{currencySymbol}} {{grandTotal}}</span>
      </div>
    </div>
  </div>

  ${config.showPaymentInfo ? `<!-- PAYMENT INFO -->
  <div style="background:${config.headerColor}08;border:1px solid ${config.headerColor}20;border-radius:${radius};padding:16px;margin-bottom:16px;position:relative;z-index:1">
    <p style="font-size:${fontSizeSmall};font-weight:600;color:${config.headerColor};text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">Info Pembayaran</p>
    <p style="font-size:${fontSizeSmall};margin:0">Bank {{bankName}} | {{bankAccountNumber}} | a.n. {{bankAccountName}}</p>
  </div>` : ''}

  ${config.showTerms ? `<!-- TERMS & CONDITIONS -->
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:${radius};padding:16px;margin-bottom:16px;position:relative;z-index:1">
    <p style="font-size:${fontSizeSmall};font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">Syarat & Ketentuan</p>
    <div style="font-size:${fontSizeSmall};color:#64748b;margin:0;line-height:1.6">${config.termsText.split('\\n').map(line => `<p style="margin:0 0 4px 0">${line}</p>`).join('')}</div>
  </div>` : ''}

  ${config.showNotes ? `<!-- NOTES -->
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:${radius};padding:16px;margin-bottom:16px;position:relative;z-index:1">
    <p style="font-size:${fontSizeSmall};font-weight:600;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">Catatan</p>
    <p style="font-size:${fontSizeSmall};margin:0;color:#92400e">${config.notesText}</p>
  </div>` : ''}

  ${config.showSignature ? `<!-- SIGNATURE AREA -->
  <table style="width:100%;margin-top:40px;position:relative;z-index:1"><tr>
    <td style="width:40%;text-align:center;vertical-align:top">
      <div style="font-size:${fontSizeSmall};color:#6b7280;margin-bottom:64px">${config.signatureLeftLabel}</div>
      <div style="border-top:1px solid #d1d5db;padding-top:8px;font-size:${fontSizeSmall}">Tanda Tangan & Nama</div>
    </td>
    <td style="width:20%"></td>
    <td style="width:40%;text-align:center;vertical-align:top">
      <div style="font-size:${fontSizeSmall};color:#6b7280;margin-bottom:64px">${config.signatureRightLabel}</div>
      <div style="border-top:1px solid #d1d5db;padding-top:8px;font-size:${fontSizeSmall};font-weight:600">{{businessName}}</div>
    </td>
  </tr></table>` : ''}

  ${config.showFooter ? `<!-- FOOTER -->
  <div style="text-align:center;padding-top:20px;border-top:1px solid ${config.tableBorderColor};margin-top:20px;position:relative;z-index:1">
    <p style="font-size:${fontSizeSmall};color:#9ca3af;margin:0">${config.footerText}</p>
  </div>` : ''}
</div>`;
}

export default function InvoiceTemplatesPage() {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formHtml, setFormHtml] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [editorTab, setEditorTab] = useState<string>("visual");
  const [visualConfig, setVisualConfig] = useState<VisualConfig>({ ...DEFAULT_VISUAL });
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Prism highlight function for code editor
  const highlightCode = useCallback((code: string) => {
    try {
      return Prism.highlight(code, Prism.languages.markup, "markup");
    } catch {
      return code;
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      setLoading(true);
      const res = await authService.fetchWithAuth("/invoice-templates");
      const data = await res.json();
      setTemplates(data.data || []);
    } catch {
      toast.error("Gagal memuat template");
    } finally {
      setLoading(false);
    }
  }

  // Replace sample data in HTML for preview
  function getPreviewHtml(html: string): string {
    let result = html;
    for (const [key, value] of Object.entries(SAMPLE_DATA)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
    }
    result = result.replace(/\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g, SAMPLE_ITEMS_HTML);
    return result;
  }

  function pushUndo(html: string) {
    setUndoStack(prev => [...prev.slice(-20), html]);
    setRedoStack([]);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, formHtml]);
    setFormHtml(prev);
    setUndoStack(u => u.slice(0, -1));
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, formHtml]);
    setFormHtml(next);
    setRedoStack(r => r.slice(0, -1));
  }

  function insertAtCursor(text: string) {
    if (textareaRef.current) {
      pushUndo(formHtml);
      const { selectionStart, selectionEnd } = textareaRef.current;
      const before = formHtml.substring(0, selectionStart);
      const after = formHtml.substring(selectionEnd);
      const newHtml = before + text + after;
      setFormHtml(newHtml);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = selectionStart + text.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    } else {
      pushUndo(formHtml);
      setFormHtml(formHtml + text);
    }
  }

  function insertVariable(variable: string) {
    insertAtCursor(variable);
  }

  async function copyVariable(variable: string) {
    await navigator.clipboard.writeText(variable);
    setCopied(variable);
    setTimeout(() => setCopied(null), 1500);
  }

  function updateVisual(partial: Partial<VisualConfig>) {
    const c = { ...visualConfig, ...partial };
    setVisualConfig(c);
    setFormHtml(generateFromVisual(c));
  }

  function openEditor(template?: InvoiceTemplate) {
    if (template) {
      setEditingTemplate(template);
      setFormName(template.name);
      setFormHtml(template.htmlBody);
      setFormIsDefault(template.isDefault);
      setIsCreating(false);
    } else {
      setEditingTemplate(null);
      setFormName("");
      setFormHtml("");
      setFormIsDefault(false);
      setIsCreating(true);
    }
    setUndoStack([]);
    setRedoStack([]);
  }

  function closeEditor() {
    setEditingTemplate(null);
    setIsCreating(false);
    setFormName("");
    setFormHtml("");
    setFormIsDefault(false);
    setEditorTab("visual");
    setPreviewFullscreen(false);
    setUndoStack([]);
    setRedoStack([]);
  }

  async function handleSave() {
    if (!formName.trim() || !formHtml.trim()) {
      toast.error("Nama dan HTML body wajib diisi");
      return;
    }
    try {
      setSaving(true);
      const isEdit = editingTemplate && !isCreating;
      const method = isEdit ? "PUT" : "POST";
      const url = isEdit ? `/invoice-templates/${editingTemplate.id}` : "/invoice-templates";
      const res = await authService.fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, htmlBody: formHtml, isDefault: formIsDefault }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(isEdit ? "Template diperbarui" : "Template dibuat");
      closeEditor();
      loadTemplates();
    } catch {
      toast.error("Gagal menyimpan template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus template ini?")) return;
    try {
      await authService.fetchWithAuth(`/invoice-templates/${id}`, { method: "DELETE" });
      toast.success("Template dihapus");
      loadTemplates();
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await authService.fetchWithAuth(`/invoice-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      toast.success("Template default diubah");
      loadTemplates();
    } catch {
      toast.error("Gagal mengubah default");
    }
  }

  // ─── Editor View ───
  if (editingTemplate || isCreating) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Editor Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={closeEditor}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
            </Button>
            <div className="h-5 w-px bg-border" />
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Nama template..."
              className="w-64 h-8 text-sm font-medium"
            />
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="checkbox"
                id="defaultCheck"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="defaultCheck" className="text-xs text-muted-foreground cursor-pointer">
                Default
              </Label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewFullscreen(!previewFullscreen)}
            >
              {previewFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Simpan
            </Button>
          </div>
        </div>

        {/* Editor Body - Split Pane */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Editor Tabs */}
          {!previewFullscreen && (
            <div className="w-1/2 border-r flex flex-col overflow-hidden min-h-0">
              <Tabs value={editorTab} onValueChange={setEditorTab} className="flex-1 flex flex-col min-h-0">
                <TabsList className="mx-3 mt-2 mb-0 self-start">
                  <TabsTrigger value="visual" className="text-xs gap-1">
                    <Palette className="h-3 w-3" /> Visual
                  </TabsTrigger>
                  <TabsTrigger value="code" className="text-xs gap-1">
                    <Code className="h-3 w-3" /> HTML Editor
                  </TabsTrigger>
                  <TabsTrigger value="variables" className="text-xs gap-1">
                    <Variable className="h-3 w-3" /> Variabel
                  </TabsTrigger>
                </TabsList>

                {/* ─── VISUAL TAB (enriched) ─── */}
                <TabsContent value="visual" className="flex-1 m-0 overflow-y-auto min-h-0 p-4">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Desain template tanpa coding. Semua perubahan langsung terlihat di preview.
                      </p>
                    </div>

                    {/* Color Presets */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Preset Warna</h4>
                      <div className="grid grid-cols-4 gap-2">
                        {COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            className="flex items-center gap-2 p-2 rounded-lg border hover:border-primary/50 transition-all group text-left"
                            onClick={() => updateVisual({ headerColor: preset.headerColor, accentColor: preset.accentColor, textColor: preset.textColor })}
                          >
                            <div className="flex gap-0.5 shrink-0">
                              <div className="w-3 h-3 rounded-full" style={{ background: preset.headerColor }} />
                              <div className="w-3 h-3 rounded-full" style={{ background: preset.accentColor }} />
                            </div>
                            <span className="text-[10px] font-medium truncate group-hover:text-primary">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Colors */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Warna Kustom</h4>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { key: 'headerColor' as const, label: 'Warna Utama' },
                          { key: 'accentColor' as const, label: 'Warna Aksen' },
                          { key: 'textColor' as const, label: 'Warna Teks' },
                        ].map(({ key, label }) => (
                          <div key={key} className="space-y-1.5">
                            <Label className="text-xs">{label}</Label>
                            <div className="flex items-center gap-2">
                              <input type="color" value={visualConfig[key]}
                                onChange={(e) => updateVisual({ [key]: e.target.value })}
                                className="w-8 h-8 rounded cursor-pointer border-0"
                              />
                              <span className="text-xs text-muted-foreground font-mono">{visualConfig[key]}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Background</Label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={visualConfig.bgColor}
                              onChange={(e) => updateVisual({ bgColor: e.target.value })}
                              className="w-8 h-8 rounded cursor-pointer border-0"
                            />
                            <span className="text-xs text-muted-foreground font-mono">{visualConfig.bgColor}</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Border Tabel</Label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={visualConfig.tableBorderColor}
                              onChange={(e) => updateVisual({ tableBorderColor: e.target.value })}
                              className="w-8 h-8 rounded cursor-pointer border-0"
                            />
                            <span className="text-xs text-muted-foreground font-mono">{visualConfig.tableBorderColor}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Header Style */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Gaya Header</h4>
                      <div className="grid grid-cols-4 gap-2">
                        {([['gradient', 'Gradien'], ['solid', 'Polos'], ['minimal', 'Minimal'], ['bordered', 'Bingkai']] as const).map(([val, label]) => (
                          <button key={val}
                            className={`p-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                              visualConfig.headerStyle === val ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'
                            }`}
                            onClick={() => updateVisual({ headerStyle: val })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Table Style */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Gaya Tabel</h4>
                      <div className="grid grid-cols-4 gap-2">
                        {([['modern', 'Modern'], ['classic', 'Klasik'], ['striped', 'Bergaris'], ['borderless', 'Tanpa Garis']] as const).map(([val, label]) => (
                          <button key={val}
                            className={`p-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                              visualConfig.tableStyle === val ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'
                            }`}
                            onClick={() => updateVisual({ tableStyle: val })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Typography */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tipografi</h4>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs mb-1.5 block">Font</Label>
                          <select
                            value={visualConfig.fontFamily}
                            onChange={(e) => updateVisual({ fontFamily: e.target.value })}
                            className="w-full p-2 rounded-md border bg-background text-sm"
                          >
                            {FONT_OPTIONS.map(f => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs mb-1.5 block">Ukuran Font</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {([['small', 'Kecil'], ['medium', 'Sedang'], ['large', 'Besar']] as const).map(([val, label]) => (
                              <button key={val}
                                className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                                  visualConfig.fontSize === val ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'
                                }`}
                                onClick={() => updateVisual({ fontSize: val })}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Spacing & Border Radius */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Layout</h4>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs mb-1.5 block">Jarak (Spacing)</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {([['compact', 'Rapat'], ['normal', 'Normal'], ['relaxed', 'Longgar']] as const).map(([val, label]) => (
                              <button key={val}
                                className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                                  visualConfig.spacing === val ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'
                                }`}
                                onClick={() => updateVisual({ spacing: val })}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs mb-1.5 block">Sudut (Border Radius)</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {([['none', 'Tajam'], ['small', 'Kecil'], ['medium', 'Sedang'], ['large', 'Besar']] as const).map(([val, label]) => (
                              <button key={val}
                                className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                                  visualConfig.borderRadius === val ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'
                                }`}
                                onClick={() => updateVisual({ borderRadius: val })}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Logo */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Logo</h4>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer hover:bg-muted/30 p-1.5 rounded-md transition-colors">
                          <input type="checkbox" checked={visualConfig.showLogo}
                            onChange={(e) => updateVisual({ showLogo: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm">Tampilkan Logo di Header</span>
                        </label>
                        {visualConfig.showLogo && (
                          <>
                            <div>
                              <Label className="text-xs mb-1.5 block">Posisi Logo</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {([['left', '⬅ Kiri'], ['center', '⬆ Tengah'], ['right', '➡ Kanan']] as const).map(([val, label]) => (
                                  <button key={val}
                                    className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                                      visualConfig.logoPosition === val ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'
                                    }`}
                                    onClick={() => updateVisual({ logoPosition: val })}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs mb-1.5 block">Ukuran Logo</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {([['small', 'Kecil'], ['medium', 'Sedang'], ['large', 'Besar']] as const).map(([val, label]) => (
                                  <button key={val}
                                    className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                                      visualConfig.logoSize === val ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/30'
                                    }`}
                                    onClick={() => updateVisual({ logoSize: val })}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                        <p className="text-[10px] text-muted-foreground">Logo diambil dari Profil Bisnis. Upload di menu Pengaturan → Profil Bisnis.</p>
                      </div>
                    </div>

                    {/* Content Toggles */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tampilkan</h4>
                      <div className="space-y-2.5">
                        {[
                          { key: 'showBusinessName' as const, label: 'Nama Bisnis di Header' },
                          { key: 'showBusinessAddress' as const, label: 'Alamat & Telepon di Header' },
                          { key: 'showItemNumbers' as const, label: 'Nomor Urut Item' },
                          { key: 'showPaymentInfo' as const, label: 'Info Pembayaran Bank' },
                          { key: 'showTax' as const, label: 'Baris Pajak (PPN)' },
                          { key: 'showDiscount' as const, label: 'Baris Diskon' },
                          { key: 'showTerms' as const, label: 'Syarat & Ketentuan' },
                          { key: 'showNotes' as const, label: 'Catatan' },
                          { key: 'showSignature' as const, label: 'Area Tanda Tangan' },
                          { key: 'showWatermark' as const, label: 'Watermark' },
                          { key: 'showFooter' as const, label: 'Footer' },
                        ].map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-3 cursor-pointer hover:bg-muted/30 p-1.5 rounded-md transition-colors">
                            <input type="checkbox" checked={visualConfig[key]}
                              onChange={(e) => updateVisual({ [key]: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Watermark Text */}
                    {visualConfig.showWatermark && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Teks Watermark</h4>
                        <Input
                          value={visualConfig.watermarkText}
                          onChange={(e) => updateVisual({ watermarkText: e.target.value })}
                          placeholder="LUNAS, DRAFT, dll..."
                          className="text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Teks besar transparan di background invoice</p>
                      </div>
                    )}

                    {/* Signature Labels */}
                    {visualConfig.showSignature && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Label Tanda Tangan</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Kiri</Label>
                            <Input
                              value={visualConfig.signatureLeftLabel}
                              onChange={(e) => updateVisual({ signatureLeftLabel: e.target.value })}
                              placeholder="Penerima"
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Kanan</Label>
                            <Input
                              value={visualConfig.signatureRightLabel}
                              onChange={(e) => updateVisual({ signatureRightLabel: e.target.value })}
                              placeholder="Hormat Kami,"
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Terms Text */}
                    {visualConfig.showTerms && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Syarat & Ketentuan</h4>
                        <textarea
                          value={visualConfig.termsText}
                          onChange={(e) => updateVisual({ termsText: e.target.value })}
                          className="w-full p-3 rounded-md border bg-background text-sm resize-none h-24"
                          placeholder="Syarat dan ketentuan pembayaran..."
                        />
                      </div>
                    )}

                    {/* Notes Text */}
                    {visualConfig.showNotes && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Teks Catatan</h4>
                        <textarea
                          value={visualConfig.notesText}
                          onChange={(e) => updateVisual({ notesText: e.target.value })}
                          className="w-full p-3 rounded-md border bg-background text-sm resize-none h-20"
                          placeholder="Catatan untuk invoice..."
                        />
                      </div>
                    )}

                    {/* Footer Text */}
                    {visualConfig.showFooter && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Teks Footer</h4>
                        <Input
                          value={visualConfig.footerText}
                          onChange={(e) => updateVisual({ footerText: e.target.value })}
                          placeholder="Teks footer..."
                          className="text-sm"
                        />
                      </div>
                    )}

                    {/* Generate button */}
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setFormHtml(generateFromVisual(visualConfig))}
                    >
                      <Sparkles className="h-4 w-4 mr-2" /> Generate Ulang Template
                    </Button>
                  </div>
                </TabsContent>

                {/* ─── HTML EDITOR TAB (code editor with syntax highlighting) ─── */}
                <TabsContent value="code" className="flex-1 m-0 overflow-hidden flex flex-col min-h-0">
                  {/* Toolbar */}
                  <div className="flex items-center gap-1 px-3 py-2 border-b bg-zinc-900 flex-wrap shrink-0">
                    {/* Undo/Redo */}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-700"
                      onClick={handleUndo} disabled={undoStack.length === 0}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-700"
                      onClick={handleRedo} disabled={redoStack.length === 0}
                    >
                      <Redo2 className="h-3.5 w-3.5" />
                    </Button>
                    <div className="w-px h-5 bg-zinc-700 mx-1" />

                    {/* Snippet buttons */}
                    {HTML_SNIPPETS.map((snippet) => (
                      <button
                        key={snippet.label}
                        className="inline-flex items-center gap-1 h-7 px-2 text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                        onClick={() => {
                          pushUndo(formHtml);
                          setFormHtml(prev => prev + snippet.html);
                        }}
                        title={snippet.label}
                      >
                        <snippet.icon className="h-3 w-3" />
                        <span className="hidden xl:inline">{snippet.label}</span>
                      </button>
                    ))}

                    <div className="w-px h-5 bg-zinc-700 mx-1" />

                    {/* Quick variable insert */}
                    <select
                      className="h-7 text-[11px] bg-zinc-800 border-zinc-700 text-zinc-300 rounded px-2 cursor-pointer"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          pushUndo(formHtml);
                          setFormHtml(prev => prev + e.target.value);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">+ Variabel</option>
                      {TEMPLATE_VARIABLES.map(v => (
                        <option key={v.key} value={v.key}>{v.label} — {v.key}</option>
                      ))}
                    </select>
                  </div>

                  {/* Code Editor with syntax highlighting */}
                  <div className="flex-1 overflow-auto bg-[#2d2d2d] min-h-0">
                    <CodeEditor
                      value={formHtml}
                      onValueChange={(code) => {
                        pushUndo(formHtml);
                        setFormHtml(code);
                      }}
                      highlight={highlightCode}
                      padding={16}
                      style={{
                        fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace",
                        fontSize: 13,
                        lineHeight: 1.6,
                        minHeight: "100%",
                        background: "#2d2d2d",
                        color: "#ccc",
                      }}
                      textareaClassName="code-editor-textarea"
                      className="code-editor-root"
                    />
                  </div>

                  {/* Status bar */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-t border-zinc-800 text-[10px] text-zinc-500 shrink-0">
                    <span>{formHtml.split('\n').length} baris | {formHtml.length} karakter</span>
                    <span>HTML • UTF-8 • Syntax Highlighting</span>
                  </div>
                </TabsContent>

                {/* ─── VARIABLES TAB ─── */}
                <TabsContent value="variables" className="flex-1 m-0 overflow-auto p-3">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Klik variabel untuk menyisipkan ke editor, atau salin ke clipboard.
                      </p>
                    </div>

                    {VARIABLE_CATEGORIES.map((cat) => (
                      <div key={cat.id}>
                        <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${cat.color}`}>
                          {cat.label}
                        </h4>
                        <div className="space-y-1">
                          {TEMPLATE_VARIABLES.filter((v) => v.category === cat.id).map((v) => (
                            <div
                              key={v.key}
                              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group cursor-pointer transition-colors"
                              onClick={() => insertVariable(v.key)}
                            >
                              <div>
                                <span className="text-xs font-medium">{v.label}</span>
                                <code className="ml-2 px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground">
                                  {v.key}
                                </code>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyVariable(v.key);
                                  }}
                                >
                                  {copied === v.key ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Right: Live Preview */}
          <div className={previewFullscreen ? "w-full" : "w-1/2"}>
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Live Preview</span>
                <Badge variant="outline" className="text-[10px] ml-auto">
                  Data Contoh
                </Badge>
              </div>
              <div className="flex-1 overflow-auto bg-white">
                {formHtml ? (
                  <div
                    className="p-6"
                    dangerouslySetInnerHTML={{ __html: getPreviewHtml(formHtml) }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Pilih tab &quot;Visual&quot; untuk mulai mendesain template</p>
                      <p className="text-xs text-muted-foreground mt-1">atau gunakan HTML Editor untuk coding manual</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Gallery View ───
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Template Invoice</h1>
          <p className="text-muted-foreground">
            Kelola dan desain template invoice untuk bisnis Anda
          </p>
        </div>
        <Button onClick={() => openEditor()}>
          <Plus className="mr-2 h-4 w-4" /> Buat Template
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={`group relative overflow-hidden transition-all hover:shadow-lg ${
              template.isDefault ? "ring-2 ring-primary" : ""
            }`}
          >
            {/* Mini Preview */}
            <div className="h-48 overflow-hidden border-b bg-white relative">
              <div
                className="transform scale-[0.3] origin-top-left w-[333%] h-[333%] pointer-events-none"
                dangerouslySetInnerHTML={{
                  __html: getPreviewHtml(template.htmlBody),
                }}
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <Button
                  size="sm"
                  variant="secondary"
                  className="shadow-lg"
                  onClick={() => openEditor(template)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shadow-lg"
                  onClick={() => {
                      setPreviewFullscreen(true);
                      setFormHtml(template.htmlBody);
                      setFormName(template.name);
                      setEditingTemplate(template);
                  }}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                </Button>
              </div>
            </div>

            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {template.name}
                {template.isDefault && (
                  <Badge className="ml-auto bg-primary/10 text-primary border-primary/20 text-[10px]">
                    <Star className="h-3 w-3 mr-0.5" /> Default
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Dibuat {new Date(template.createdAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => openEditor(template)}
                >
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                {!template.isDefault && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleSetDefault(template.id)}
                    >
                      <Star className="h-3 w-3 mr-1" /> Default
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card className="py-12 text-center">
          <CardContent>
            <Palette className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">Belum ada template</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Template akan di-generate otomatis saat pertama kali diakses.
            </p>
            <Button onClick={() => openEditor()}>
              <Plus className="mr-2 h-4 w-4" /> Buat Template Pertama
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
