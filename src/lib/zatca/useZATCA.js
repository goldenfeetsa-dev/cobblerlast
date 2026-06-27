/**
 * useZATCA hook
 * Handles Phase 1 (XML + QR) and Phase 2 (API clearance/reporting)
 * Called automatically when an invoice is created
 */
import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  buildZatcaTLV,
  generateInvoiceXML,
  submitToZATCA,
  xmlToBase64,
  sha256Base64,
  ZATCAError,
} from './zatcaUtils';
import { addToLog } from '@/pages/ZATCASettings';
import { supabase } from '@/lib/supabaseClient';

function loadZatcaConfig() {
  try {
    return JSON.parse(localStorage.getItem('zatca_config') || '{}');
  } catch { return {}; }
}

export function useZATCA() {
  /**
   * Submit invoice to ZATCA (Phase 2) + generate QR (Phase 1)
   * @param {Object} invoice - SalesInvoice or Order object from the database
   * @param {'simplified'|'standard'} invoiceType
   * @returns {Object} { qrCode, zatcaStatus, zatcaResponse }
   */
  const submitInvoice = useCallback(async (invoice, invoiceType = 'simplified') => {
    const cfg = loadZatcaConfig();

    // ── Phase 1: Always generate QR ─────────────────────────
    const qrCode = buildZatcaTLV({
      sellerName: cfg.sellerName || 'إبرة وخيط الإسكافي',
      vatNumber: cfg.vatNumber || '',
      invoiceDate: invoice.created_at ? new Date(invoice.created_at) : new Date(),
      totalAmount: invoice.total || invoice.total_price || 0,
      vatAmount: invoice.vat_amount || 0,
    });

    // If ZATCA Phase 2 not configured or disabled, return Phase 1 only
    if (!cfg.enabled || !cfg.certificateBase64 || !cfg.privateKeyBase64) {
      return { qrCode, zatcaStatus: 'PHASE1_ONLY', warnings: [] };
    }

    // ── Phase 2: Generate XML + Submit ──────────────────────
    try {
      const seller = {
        name: cfg.sellerName || 'إبرة وخيط الإسكافي',
        vatNumber: cfg.vatNumber,
        crNumber: cfg.crNumber,
        city: cfg.city || 'الرياض',
        district: cfg.district || 'الرياض',
        street: cfg.street || 'غير محدد',
        postalCode: cfg.postalCode || '11111',
      };

      // Normalize items (support both SalesInvoice items and Order)
      const items = invoice.items?.length
        ? invoice.items
        : [{
            item_name: invoice.description || 'خدمة إصلاح',
            qty: invoice.quantity || 1,
            sell_price: invoice.subtotal || invoice.total_price || 0,
            unit: 'PCE',
          }];

      const xmlString = generateInvoiceXML({
        invoiceNumber: invoice.invoice_number || invoice.order_number || `INV-${invoice.id}`,
        invoiceType: cfg.invoiceType || invoiceType,
        invoiceDate: invoice.created_at ? new Date(invoice.created_at) : new Date(),
        seller,
        buyer: {
          name: invoice.customer_name || 'عميل نقدي',
          vatNumber: invoice.customer_vat || '',
          city: 'الرياض',
        },
        items,
        subtotal: invoice.subtotal || (invoice.total || invoice.total_price || 0) / 1.15,
        vatAmount: invoice.vat_amount || (invoice.total || invoice.total_price || 0) * 0.15 / 1.15,
        total: invoice.total || invoice.total_price || 0,
        paymentMethod: invoice.payment_method || 'cash',
      });

      const xmlBase64 = xmlToBase64(xmlString);
      const invoiceHash = await sha256Base64(xmlString);
      const uuid = xmlString.match(/<cbc:UUID>(.*?)<\/cbc:UUID>/)?.[1] || crypto.randomUUID();

      const mode = (cfg.invoiceType || invoiceType) === 'standard' ? 'clearance' : 'reporting';

      const response = await submitToZATCA({
        xmlContent: xmlBase64,
        invoiceHash,
        uuid,
        certificateBase64: cfg.certificateBase64,
        privateKeyBase64: cfg.privateKeyBase64,
        mode,
        sandbox: cfg.sandbox !== false,
      });

      const status = response.reportingStatus || 'REPORTED';

      // Log to localStorage
      addToLog({
        invoiceNumber: invoice.invoice_number || invoice.order_number,
        customerName: invoice.customer_name || 'عميل نقدي',
        total: invoice.total || invoice.total_price,
        status,
        warnings: response.warnings?.map(w => w.message) || [],
        mode,
      });

      // Update invoice record in DB with ZATCA status
      if (invoice.id) {
        try {
          const table = invoice.invoice_number ? 'sales_invoices' : 'orders';
          await supabase.from(table).update({
            zatca_status: status,
            zatca_qr: response.qrCode || qrCode,
            zatca_submitted_at: new Date().toISOString(),
          }).eq('id', invoice.id);
        } catch (updateErr) {
          console.warn('Could not update ZATCA status in DB:', updateErr);
        }
      }

      if (response.warnings?.length > 0) {
        toast.warning(`⚠️ زاتكا: ${response.warnings[0]?.message || 'تحذير'}`);
      } else {
        toast.success(`✅ تم الإرسال لزاتكا — الحالة: ${status}`);
      }

      return {
        qrCode: response.qrCode || qrCode,
        zatcaStatus: status,
        zatcaResponse: response,
        warnings: response.warnings || [],
        xmlContent: xmlBase64,
      };

    } catch (err) {
      const message = err instanceof ZATCAError
        ? err.message
        : 'فشل الإرسال لزاتكا';

      addToLog({
        invoiceNumber: invoice.invoice_number || invoice.order_number,
        customerName: invoice.customer_name,
        status: 'REJECTED',
        error: message,
      });

      toast.error(`❌ زاتكا: ${message}`);

      // Return Phase 1 QR even if Phase 2 fails — invoice still valid locally
      return { qrCode, zatcaStatus: 'REJECTED', error: message, warnings: [] };
    }
  }, []);

  return { submitInvoice };
}
