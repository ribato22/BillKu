'use client';

import { useEffect, useState, use } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, Clock, CheckCircle, XCircle, Loader2, Building2, FileText, AlertCircle, ExternalLink } from 'lucide-react';

interface PaymentLinkData {
  id: string;
  paymentUrl: string;
  amount: string;
  status: 'ACTIVE' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  paidAt?: string;
  provider: string;
  isSandbox: boolean;
  invoice: {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    subtotal: string;
    total: string;
    currencyCode: string;
    items: Array<{
      description: string;
      qty: string;
      unitPrice: string;
      total: string;
    }>;
  };
  customer: {
    name: string;
  };
  business: {
    name: string;
    address?: string;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function PaymentPage({
  params,
}: {
  params: Promise<{ linkId: string }>;
}) {
  const { linkId } = use(params);
  const t = useTranslations('payLink');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PaymentLinkData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  async function loadPaymentLink() {
    try {
      const response = await fetch(`${API_BASE}/pay/${linkId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError(t('linkNotFound'));
        } else {
          setError(t('generalError'));
        }
        return;
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Failed to load payment link:', err);
      setError(t('failedLoadPayment'));
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: string, currencyCode: string = 'IDR'): string {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
    }).format(num);
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function getTimeRemaining(expiresAt: string): string {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return t('expired');
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return t('daysHoursRemaining', { days, hours: hours % 24 });
    }
    return t('hoursMinutesRemaining', { hours, minutes });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('loadingPayment')}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t('invalidLink')}
          </h1>
          <p className="text-gray-600">
            {error || t('linkNotFoundOrExpired')}
          </p>
        </div>
      </div>
    );
  }

  const isExpired = data.status === 'EXPIRED' || new Date(data.expiresAt) < new Date();
  const isPaid = data.status === 'PAID';
  const isCancelled = data.status === 'CANCELLED';
  const isActive = data.status === 'ACTIVE' && !isExpired;

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">BillKu</h1>
              <p className="text-xs text-gray-500">{t('paymentPage')}</p>
            </div>
          </div>
          {data.isSandbox && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
              {t('sandboxMode')}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Banner */}
        {isPaid && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">{t('paymentSuccess')}</p>
              <p className="text-sm text-green-600">
                {t('paidOn', { date: data.paidAt ? formatDate(data.paidAt) : 'N/A' })}
              </p>
            </div>
          </div>
        )}

        {isExpired && !isPaid && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-600" />
            <div>
              <p className="font-semibold text-red-800">{t('linkExpired')}</p>
              <p className="text-sm text-red-600">
                {t('requestNewLink')}
              </p>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-gray-600" />
            <div>
              <p className="font-semibold text-gray-800">{t('paymentCancelled')}</p>
              <p className="text-sm text-gray-600">
                {t('linkCancelled')}
              </p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Invoice Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Invoice Card */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-linear-to-r from-primary-600 to-primary-700 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6" />
                  <h2 className="text-lg font-semibold">Invoice {data.invoice.invoiceNumber}</h2>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Business Info */}
                <div className="flex items-start gap-3 pb-4 border-b">
                  <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">{data.business.name}</p>
                    {data.business.address && (
                      <p className="text-sm text-gray-600">{data.business.address}</p>
                    )}
                  </div>
                </div>

                {/* Invoice Meta */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">{t('billTo')}</p>
                    <p className="font-medium text-gray-900">{data.customer.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500">{t('dueDate')}</p>
                    <p className="font-medium text-gray-900">{formatDate(data.invoice.dueDate)}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-600">{t('itemCol')}</th>
                        <th className="px-4 py-2 text-center text-gray-600">{t('qtyCol')}</th>
                        <th className="px-4 py-2 text-right text-gray-600">{t('priceCol')}</th>
                        <th className="px-4 py-2 text-right text-gray-600">{t('totalCol')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.invoice.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-gray-900">{item.description}</td>
                          <td className="px-4 py-3 text-center text-gray-600">{item.qty}</td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {formatCurrency(item.unitPrice, data.invoice.currencyCode)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {formatCurrency(item.total, data.invoice.currencyCode)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">{t('subtotal')}</span>
                    <span className="text-gray-900">{formatCurrency(data.invoice.subtotal, data.invoice.currencyCode)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                    <span className="text-lg font-bold text-gray-900">{t('total')}</span>
                    <span className="text-lg font-bold text-primary-600">
                      {formatCurrency(data.invoice.total, data.invoice.currencyCode)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Action Card */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <h3 className="font-semibold text-gray-900 mb-4">{t('paymentSummary')}</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('totalBill')}</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(data.amount, data.invoice.currencyCode)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('method')}</span>
                  <span className="text-gray-900">{data.provider}</span>
                </div>
                {isActive && (
                  <div className="flex items-center gap-2 text-sm text-orange-600">
                    <Clock className="h-4 w-4" />
                    <span>{getTimeRemaining(data.expiresAt)}</span>
                  </div>
                )}
              </div>

              {isActive && (
                <a
                  href={data.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-linear-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl"
                >
                  {t('payNow')}
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}

              {isPaid && (
                <div className="text-center py-3 bg-green-50 rounded-xl">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="font-semibold text-green-800">{t('alreadyPaid')}</p>
                </div>
              )}

              {(isExpired || isCancelled) && !isPaid && (
                <div className="text-center py-3 bg-gray-50 rounded-xl">
                  <XCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">{t('linkInactive')}</p>
                </div>
              )}
            </div>

            {/* Security Note */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm">
              <p className="text-blue-800">
                <strong>{t('secureTrusted')}</strong>
              </p>
              <p className="text-blue-600 mt-1">
                {t('secureDescription', { provider: data.provider })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>{t('poweredBy')} <strong>BillKu</strong> - {t('tagline')}</p>
        </div>
      </div>
    </div>
  );
}
