import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/api/supabaseApi';
import { secureZatca } from '@/lib/secureApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Undo2, ExternalLink, Loader2, PackageSearch, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { SarAmount } from '@/components/shared/SarCurrency';

export default function Returns() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [found, setFound] = useState(null); // { type: 'order'|'sale', record }
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [noteType, setNoteType] = useState('credit');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');

  // سجل المرتجعات (إشعارات الدائن/المدين) — آخر 200
  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['zatca-notes'],
    queryFn: () => secureZatca.getNotes(),
  });

  const search = async () => {
    const trimmed = code.trim().replace(/-\d+$/, ''); // يشيل رقم القطعة الفرعي إن انكتب
    if (!trimmed) return;
    setSearching(true);
    setSearchError('');
    setFound(null);
    try {
      const orderMatches = await db.Order.filter({ order_number: trimmed }, '-created_at', 1);
      if (orderMatches?.[0]) {
        setFound({ type: 'order', record: orderMatches[0] });
        setAmount(String(orderMatches[0].total_price || ''));
        return;
      }
      const saleMatches = await db.SalesInvoice.filter({ invoice_number: trimmed }, '-created_at', 1);
      if (saleMatches?.[0]) {
        setFound({ type: 'sale', record: saleMatches[0] });
        setAmount(String(saleMatches[0].total || ''));
        return;
      }
      setSearchError('ما فيه طلب ولا فاتورة برقم ' + trimmed);
    } catch (e) {
      setSearchError(e.message || 'تعذّر البحث');
    } finally {
      setSearching(false);
    }
  };

  const issueNote = useMutation({
    mutationFn: () => secureZatca.issueNote({
      noteType,
      originalRecordType: found.type,
      originalRecordId: found.record.id,
      reason,
      amount: Number(amount),
    }),
    onSuccess: (res) => {
      toast.success(`✅ تم إصدار ${noteType === 'credit' ? 'المرتجع' : 'إشعار المدين'} رقم ${res.note?.note_number} وإرساله لزاتكا`);
      queryClient.invalidateQueries({ queryKey: ['zatca-notes'] });
      setFound(null);
      setCode('');
      setReason('');
      setAmount('');
    },
    onError: (err) => toast.error('فشل إصدار المرتجع: ' + err.message),
  });

  const recordNumber = found ? (found.type === 'order' ? found.record.order_number : found.record.invoice_number) : '';
  const recordDate = found ? found.record.created_at : null;
  const recordCustomer = found ? found.record.customer_name : '';
  const isZatcaReported = found && ['REPORTED', 'CLEARED'].includes(found.record.zatca_status);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Undo2 className="w-6 h-6" style={{ color: 'hsl(var(--primary))' }} />
          المرتجعات
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ابحث برقم الطلب أو رقم الفاتورة، وأصدر مرتجع (إشعار دائن) رسمي يُرسل تلقائياً لزاتكا
        </p>
      </div>

      {/* ── خطوة 1: البحث برقم الفاتورة/الطلب ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">١. ابحث عن الفاتورة أو الطلب</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="رقم الطلب أو رقم الفاتورة"
              dir="ltr"
              className="text-left font-bold"
            />
            <Button onClick={search} disabled={searching || !code.trim()}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="mr-1">بحث</span>
            </Button>
          </div>
          {searchError && (
            <p className="text-sm text-destructive mt-3 flex items-center gap-1.5">
              <PackageSearch className="w-4 h-4" /> {searchError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── خطوة 2: تفاصيل الفاتورة الموجودة + نموذج إصدار المرتجع ── */}
      {found && (
        <Card className="border-2" style={{ borderColor: 'hsl(var(--primary))' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ReceiptText className="w-4 h-4" />
                {recordNumber}
                <Badge variant="outline">{found.type === 'order' ? 'طلب إصلاح' : 'فاتورة مبيعات'}</Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate(found.type === 'order' ? `/orders/${found.record.id}` : '/invoices')}>
                فتح الأصل <ExternalLink className="w-3.5 h-3.5 mr-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-4 text-sm bg-muted/40 rounded-xl p-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">العميل</p>
                <p className="font-bold">{recordCustomer || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">التاريخ</p>
                <p className="font-bold">{recordDate ? format(new Date(recordDate), 'yyyy-MM-dd') : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">المبلغ الإجمالي</p>
                <p className="font-bold"><SarAmount value={found.record.total_price ?? found.record.total} /></p>
              </div>
            </div>

            {isZatcaReported && (
              <p className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 rounded-lg p-3 leading-relaxed">
                ⚠️ هذه الفاتورة مُبلَّغة لزاتكا مسبقاً — الطريقة الرسمية الوحيدة لاسترجاعها هي إصدار إشعار دائن يُصفّرها محاسبياً، مو حذفها أو تعديلها مباشرة.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>نوع الإشعار</Label>
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">إشعار دائن (مرتجع / تخفيض مبلغ)</SelectItem>
                    <SelectItem value="debit">إشعار مدين (زيادة مبلغ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>المبلغ (شامل الضريبة)</Label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" className="text-left" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>سبب المرتجع *</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: العميل غير راضٍ عن جودة التصليح، أو استرجاع كامل بطلب العميل" className="min-h-[80px]" />
            </div>

            <Button
              onClick={() => issueNote.mutate()}
              disabled={issueNote.isPending || !reason.trim() || !(Number(amount) > 0)}
              className="w-full"
            >
              {issueNote.isPending ? 'جارٍ الإرسال لزاتكا...' : `إصدار ${noteType === 'credit' ? 'المرتجع' : 'إشعار المدين'} وإرساله لزاتكا`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── سجل كل المرتجعات السابقة ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">سجل المرتجعات والإشعارات</CardTitle>
        </CardHeader>
        <CardContent>
          {notesLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">جارٍ التحميل...</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">ما فيه أي مرتجعات مسجّلة بعد</p>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="flex items-center justify-between border rounded-xl p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant={n.note_type === 'credit' ? 'destructive' : 'default'}>
                      {n.note_type === 'credit' ? 'دائن' : 'مدين'}
                    </Badge>
                    <div>
                      <p className="font-bold">{n.note_number}</p>
                      <p className="text-xs text-muted-foreground">{n.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-xs text-muted-foreground">{format(new Date(n.created_at), 'yyyy-MM-dd HH:mm')}</p>
                    <p className="font-black"><SarAmount value={n.amount} /></p>
                    <Link to={n.original_record_type === 'order' ? `/orders/${n.original_record_id}` : '/invoices'}>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
