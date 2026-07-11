import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, PlusCircle, MinusCircle, Award, Loader2, History, UserPlus, RefreshCw } from 'lucide-react';
import { useLoyaltyMembers } from '@/lib/loyalty/useLoyaltyMembers';
import { getSession } from '@/lib/sessionStore';

const LEVEL_COLORS = {
  Bronze: 'bg-amber-800/20 text-amber-400 border-amber-700/40',
  Silver: 'bg-slate-400/20 text-slate-300 border-slate-400/40',
  Gold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  Platinum: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
};

const LEVEL_LABELS_AR = { Bronze: 'برونزي', Silver: 'فضي', Gold: 'ذهبي', Platinum: 'بلاتيني' };

export default function LoyaltyMembersAdmin() {
  const session = getSession();
  const { loading, lookupMember, adjustPoints, createMember } = useLoyaltyMembers();

  const [searchValue, setSearchValue] = useState('');
  const [result, setResult] = useState(null); // { member, history, notifications }
  const [searched, setSearched] = useState(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState('add'); // add | deduct
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const doSearch = async () => {
    const value = searchValue.trim();
    if (!value) return;
    setSearched(true);
    const data = await lookupMember({ member_number: value });
    setResult(data);
  };

  const refreshCurrent = async () => {
    if (!result?.member?.member_number) return;
    const data = await lookupMember({ member_number: result.member.member_number });
    setResult(data);
  };

  const openAdjust = (mode) => {
    setAdjustMode(mode);
    setAdjustAmount('');
    setAdjustReason('');
    setAdjustOpen(true);
  };

  const submitAdjust = async () => {
    const amountNum = Math.abs(Number(adjustAmount));
    if (!amountNum || Number.isNaN(amountNum)) return;
    const change = adjustMode === 'add' ? amountNum : -amountNum;
    try {
      await adjustPoints({
        member_number: result.member.member_number,
        change_amount: change,
        reason: adjustReason,
        performed_by: session?.name || 'مدير النظام',
        performed_by_id: session?.id || null,
      });
      setAdjustOpen(false);
      await refreshCurrent();
    } catch {
      // toast already shown by the hook
    }
  };

  const submitCreate = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    try {
      const data = await createMember({ full_name: newName.trim(), phone: newPhone.trim(), email: newEmail.trim() || undefined });
      setCreateOpen(false);
      setNewName(''); setNewPhone(''); setNewEmail('');
      if (data?.member) {
        setSearchValue(data.member.member_number);
        const fresh = await lookupMember({ member_number: data.member.member_number });
        setResult(fresh);
        setSearched(true);
      }
    } catch {
      // toast already shown
    }
  };

  const member = result?.member;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Award className="w-7 h-7 text-yellow-500" />
          <h1 className="text-2xl font-bold">برنامج الولاء — النقاط والعضويات</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" /> عضوية جديدة
        </Button>
      </div>

      {/* البحث برقم العضوية فقط */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="ابحث برقم العضوية — مثال: NT-A1B2C3D4"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              className="flex-1"
            />
            <Button onClick={doSearch} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              بحث
            </Button>
          </div>
        </CardContent>
      </Card>

      {searched && !loading && !member && (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">لم يتم العثور على عضو بهذا الرقم.</CardContent></Card>
      )}

      {member && (
        <>
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {member.full_name}
                <Badge variant="outline" className={LEVEL_COLORS[member.membership_level]}>
                  {LEVEL_LABELS_AR[member.membership_level] || member.membership_level}
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={refreshCurrent} title="تحديث">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <InfoItem label="رقم العضوية" value={member.member_number} />
                <InfoItem label="الجوال" value={member.phone} />
                <InfoItem label="النقاط الحالية" value={member.points} big />
                <InfoItem label="البريد" value={member.email || '—'} />
              </div>
              <div className="flex gap-3">
                <Button onClick={() => openAdjust('add')} className="gap-2 bg-green-600 hover:bg-green-700">
                  <PlusCircle className="w-4 h-4" /> إضافة نقاط
                </Button>
                <Button onClick={() => openAdjust('deduct')} variant="destructive" className="gap-2">
                  <MinusCircle className="w-4 h-4" /> خصم نقاط
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="w-4 h-4" /> سجل عمليات النقاط
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!result.history || result.history.length === 0) ? (
                <p className="text-sm text-muted-foreground">لا توجد عمليات مسجّلة بعد.</p>
              ) : (
                <div className="space-y-2">
                  {result.history.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
                      <div>
                        <span className={tx.change_amount > 0 ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
                          {tx.change_amount > 0 ? `+${tx.change_amount}` : tx.change_amount}
                        </span>
                        <span className="text-muted-foreground mx-2">•</span>
                        <span>{tx.reason || 'بدون سبب مُحدد'}</span>
                      </div>
                      <div className="text-muted-foreground text-xs text-left">
                        <div>{tx.performed_by || '—'}</div>
                        <div>{new Date(tx.created_at).toLocaleString('ar-SA')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog: إضافة/خصم نقاط */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{adjustMode === 'add' ? 'إضافة نقاط' : 'خصم نقاط'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>عدد النقاط</Label>
              <Input type="number" min="1" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="مثال: 100" />
            </div>
            <div>
              <Label>السبب (إلزامي — يُحفظ في سجل التدقيق)</Label>
              <Textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="مثال: مكافأة عملية شراء #1234" />
            </div>
            <Button
              onClick={submitAdjust}
              disabled={loading || !adjustAmount || !adjustReason.trim()}
              className="w-full"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: عضوية جديدة */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إنشاء عضوية ولاء جديدة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم العميل الكامل</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <Label>رقم الجوال</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="05xxxxxxxx" />
            </div>
            <div>
              <Label>البريد الإلكتروني (اختياري)</Label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <Button onClick={submitCreate} disabled={loading || !newName.trim() || !newPhone.trim()} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إنشاء العضوية'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ label, value, big }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={big ? 'text-2xl font-bold text-yellow-500' : 'font-semibold'}>{value}</div>
    </div>
  );
}
