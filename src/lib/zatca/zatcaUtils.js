/**
 * ZATCA e-Invoicing Integration
 * Phase 1: XML generation + TLV QR Code (فاتورة إلكترونية)
 * Phase 2: Clearance & Reporting via ZATCA API (ربط مباشر)
 * 
 * Standards: UBL 2.1, ZATCA e-Invoicing Implementation Standard v3.2
 */

// ── ZATCA API Endpoints ─────────────────────────────────────────
export const ZATCA_ENDPOINTS = {
  // Simulation / Testing
  sandbox: {
    compliance: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance',
    reporting: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/reporting/single',
    clearance: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/clearance/single',
  },
  // Production
  production: {
    compliance: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance',
    reporting: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/reporting/single',
    clearance: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/clearance/single',
  }
};

// ── Phase 1: TLV QR Code ────────────────────────────────────────
/**
 * Build ZATCA-compliant TLV QR string (Phase 1)
 * Tags: 1=seller, 2=vat, 3=timestamp, 4=total, 5=vat_amount
 */
export const buildZatcaTLV = ({ sellerName, vatNumber, invoiceDate, totalAmount, vatAmount }) => {
  const encode = (tag, value) => {
    const bytes = new TextEncoder().encode(value);
    return new Uint8Array([tag, bytes.length, ...bytes]);
  };

  const timestamp = invoiceDate instanceof Date
    ? invoiceDate.toISOString().replace('.000', '')
    : new Date().toISOString().replace('.000', '');

  const parts = [
    encode(1, sellerName || 'مؤسسة إبرة وخيط الإسكافي للتجارة'),
    encode(2, vatNumber || '314151483700003'),
    encode(3, timestamp),
    encode(4, Number(totalAmount || 0).toFixed(2)),
    encode(5, Number(vatAmount || 0).toFixed(2)),
  ];

  const totalBytes = parts.reduce((a, b) => a + b.length, 0);
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const p of parts) { merged.set(p, offset); offset += p.length; }
  return btoa(String.fromCharCode(...merged));
};

// ── Phase 1: UBL 2.1 XML Invoice ───────────────────────────────
/**
 * Generate ZATCA-compliant UBL 2.1 XML invoice
 */
export const generateInvoiceXML = ({
  invoiceNumber,
  invoiceType = 'simplified', // 'simplified' | 'standard'
  invoiceDate,
  supplyDate,
  seller,
  buyer,
  items,
  subtotal,
  vatAmount,
  total,
  paymentMethod = 'cash', // 10=cash, 30=credit, 42=bank
  currency = 'SAR',
  previousInvoiceHash = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NjQyZjNiYmI4YTM4ZjE4NA==',
}) => {
  const now = invoiceDate instanceof Date ? invoiceDate : new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toISOString().split('T')[1].replace('.000Z', 'Z');
  const supplyDateStr = supplyDate instanceof Date ? supplyDate.toISOString().split('T')[0] : dateStr;

  // Invoice type codes per ZATCA
  const typeCode = invoiceType === 'standard' ? '380' : '388'; // 380=standard, 388=simplified
  const subType = invoiceType === 'standard' ? '0100000' : '0200000';

  // Payment means code
  const paymentCode = paymentMethod === 'cash' ? '10' : paymentMethod === 'credit' ? '30' : '42';

  const lineItems = (items || []).map((item, idx) => `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${item.unit || 'PCE'}">${item.qty || 1}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${currency}">${Number(item.sell_price * item.qty).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${currency}">${Number(item.sell_price * item.qty * 0.15).toFixed(2)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="${currency}">${Number(item.sell_price * item.qty * 1.15).toFixed(2)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${escapeXml(item.item_name || item.name || 'منتج')}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>15</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currency}">${Number(item.sell_price).toFixed(2)}</cbc:PriceAmount>
        <cbc:BaseQuantity unitCode="${item.unit || 'PCE'}">1</cbc:BaseQuantity>
      </cac:Price>
    </cac:InvoiceLine>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent>
        <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"
          xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"
          xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
          <sac:SignatureInformation>
            <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
            <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
            <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
              <ds:SignedInfo>
                <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
              </ds:SignedInfo>
              <ds:SignatureValue/>
            </ds:Signature>
          </sac:SignatureInformation>
        </sig:UBLDocumentSignatures>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoiceNumber)}</cbc:ID>
  <cbc:UUID>${generateUUID()}</cbc:UUID>
  <cbc:IssueDate>${dateStr}</cbc:IssueDate>
  <cbc:IssueTime>${timeStr}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${subType}">${typeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${currency}</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${invoiceNumber.replace(/\D/g, '') || '1'}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${previousInvoiceHash}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${escapeXml(seller.crNumber || '0000000000')}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(seller.street || 'الرياض')}</cbc:StreetName>
        <cbc:BuildingNumber>${seller.buildingNo || '0000'}</cbc:BuildingNumber>
        <cbc:CityName>${escapeXml(seller.city || 'الرياض')}</cbc:CityName>
        <cbc:PostalZone>${seller.postalCode || '11111'}</cbc:PostalZone>
        <cbc:CountrySubentity>${escapeXml(seller.district || 'الرياض')}</cbc:CountrySubentity>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(seller.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(seller.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(buyer?.street || 'غير محدد')}</cbc:StreetName>
        <cbc:BuildingNumber>0000</cbc:BuildingNumber>
        <cbc:CityName>${escapeXml(buyer?.city || 'الرياض')}</cbc:CityName>
        <cbc:PostalZone>00000</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(buyer?.vatNumber || 'غير مسجل')}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(buyer?.name || 'عميل نقدي')}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${supplyDateStr}</cbc:ActualDeliveryDate>
  </cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${paymentCode}</cbc:PaymentMeansCode>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${Number(vatAmount).toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${Number(subtotal).toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${Number(vatAmount).toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${Number(subtotal).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${Number(subtotal).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${Number(total).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${currency}">0.00</cbc:AllowanceTotalAmount>
    <cbc:PrepaidAmount currencyID="${currency}">0.00</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="${currency}">${Number(total).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineItems}
</Invoice>`;

  return xml.trim();
};

// ── Phase 2: ZATCA API Client ───────────────────────────────────
/**
 * Submit invoice for clearance (standard invoices) or reporting (simplified)
 * 
 * @param {Object} params
 * @param {string} params.xmlContent - Base64-encoded signed XML
 * @param {string} params.invoiceHash - SHA256 hash of XML
 * @param {string} params.uuid - Invoice UUID
 * @param {string} params.certificateBase64 - ZATCA certificate (base64)
 * @param {string} params.privateKeyBase64 - Private key (base64)
 * @param {'clearance'|'reporting'} params.mode - Invoice type
 * @param {boolean} params.sandbox - Use sandbox environment
 */
export const submitToZATCA = async ({
  xmlContent,
  invoiceHash,
  uuid,
  certificateBase64,
  privateKeyBase64,
  mode = 'reporting', // simplified = reporting, standard = clearance
  sandbox = false,
}) => {
  const env = sandbox ? ZATCA_ENDPOINTS.sandbox : ZATCA_ENDPOINTS.production;
  const url = mode === 'clearance' ? env.clearance : env.reporting;

  // Build Basic auth from certificate + private key
  const credentials = btoa(`${certificateBase64}:${privateKeyBase64}`);

  const payload = {
    invoiceHash,
    uuid,
    invoice: xmlContent, // base64 encoded XML
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': 'ar',
      'Accept-Version': 'V2',
      'Authorization': `Basic ${credentials}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errors = data?.validationResults?.errorMessages?.map(e => e.message).join(', ') || data?.message || 'خطأ في زاتكا';
    throw new ZATCAError(errors, response.status, data);
  }

  return {
    status: response.status,
    reportingStatus: data.reportingStatus || data.clearanceStatus,
    warnings: data.validationResults?.warningMessages || [],
    clearedInvoice: data.clearedInvoice, // only for clearance
    qrCode: data.qrCode,
    data,
  };
};

// ── Compliance Check ────────────────────────────────────────────
export const checkCompliance = async ({ certificateBase64, privateKeyBase64, sandbox = true }) => {
  const env = sandbox ? ZATCA_ENDPOINTS.sandbox : ZATCA_ENDPOINTS.production;
  const credentials = btoa(`${certificateBase64}:${privateKeyBase64}`);

  const response = await fetch(env.compliance, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Accept-Version': 'V2',
    },
  });

  return response.json();
};

// ── Helpers ─────────────────────────────────────────────────────
export class ZATCAError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ZATCAError';
    this.status = status;
    this.data = data;
  }
}

const escapeXml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

/**
 * Compute SHA-256 hash of string and return base64
 */
export const sha256Base64 = async (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
};

/**
 * Convert XML string to base64
 */
export const xmlToBase64 = (xmlString) => btoa(unescape(encodeURIComponent(xmlString)));

/**
 * Validate Saudi VAT number format (15 digits, starts with 3, ends with 3)
 */
export const validateVATNumber = (vat) => {
  return /^3\d{13}3$/.test(vat);
};

export { generateUUID, escapeXml };
