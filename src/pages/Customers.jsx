import React, { useState } from 'react';
import { base44 } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Users, Search, Star, ShoppingBag, Wallet, MessageCircle, CheckSquare, Square, Send } from 'lucide-react';
import StampCard from '@/components/pos/StampCard';
import { getSession } from '@/lib/sessionStore';
import { useToast } from '@/components/ui/use-toast';

export default function Customers() {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [msgTemplate, setMsgTemplate] = useState('يا هلا {اسم العميل}! 👋\nعروض خاصة من إبرة وخيط الإسكافي تنتظرك.\nاحجز موعدك الآن: https://wa.me/966549678191');
  const session = getSession();
  const isAdmin = ['admin','owner','manager'].includes(session?.role);
  const { toast } = useToast();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_at', 200),
    initialData: [],
  });

  const { data: settingsList } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => base44.entities.AppSettings.list(),
    initialData: [],
  });
  const stampsRequired = settingsList[0]?.stamps_required || 10;

  const filtered = customers.filter(c => {
    if (!search) return true;
    return c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search);
  });

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    const withPhone = filtered.filter(c => c.phone);
    if (selectedIds.length === withPhone.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(withPhone.map(c => c.id));
    }
  };

  const sendMessages = () => {
    const targets = customers.filter(c => selectedIds.includes(c.id) && c.phone);
    targets.forEach(c => {
      const msg = msgTemplate.replace('{اسم العميل}', c.name || 'عزيزي العميل');
      const phone = c.phone.replace(/^0/, '966').replace(/\D/g, '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    });
    toast({ title: `تم فتح ${targets.length} محادثة واتساب` });
    setWhatsappOpen(false);
    setSelectedIds([]);
  };

  const withPhone = filtered.filter(c => c.phone);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">العملاء</h1>
            <p className="text-sm text-muted-foreground">{customers.length} عميل</p>
          </div>
        </div>
        {isAdmin && selectedIds.length > 0 && (
          <Button
            onClick={() => setWhatsappOpen(true)}
            className="bg-[#25D366] hover:bg-[#20bb5a] text-white gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            إرسال واتساب ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* Search + Select All */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو رقم الهاتف..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {isAdmin && withPhone.length > 0 && (
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {selectedIds.length === withPhone.length
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4" />}
            تحديد الكل ({withPhone.length})
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا يوجد عملاء</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const isSelected = selectedIds.includes(c.id);
            return (
              <Card
                key={c.id}
                className={`hover:shadow-md transition-all cursor-pointer ${isAdmin && c.phone ? 'hover:border-primary/30' : ''} ${isSelected ? 'border-primary ring-1 ring-primary/20' : ''}`}
                onClick={() => isAdmin && c.phone && toggleSelect(c.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1">
                      {isAdmin && c.phone && (
                        <div className="flex-shrink-0">
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4 text-muted-foreground/40" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate">{c.name}</h3>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground">{c.phone || 'لا يوجد هاتف'}</p>
                          {c.phone && (
                            <a
                              href={`https://wa.me/966${c.phone.replace(/^0/, '').replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-500 hover:text-green-600 transition-colors"
                              title="فتح واتساب"
                              onClick={e => e.stopPropagation()}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 flex-shrink-0">
                      <Star className="w-3 h-3" />
                      {c.loyalty_points || 0}
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-sm mb-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {c.total_orders || 0} طلب
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Wallet className="w-3.5 h-3.5" />
                      {(c.total_spent || 0).toFixed(0)} SAR
                    </div>
                  </div>
                  <StampCard customer={c} stampsRequired={stampsRequired} isAdmin={isAdmin} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* WhatsApp Bulk Dialog */}
      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              رسالة واتساب جماعية
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              سيتم إرسال رسالة لـ <span className="font-bold text-foreground">{selectedIds.length}</span> عميل
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                نص الرسالة
                <span className="text-xs text-muted-foreground font-normal mr-2">(&#123;اسم العميل&#125; للتخصيص)</span>
              </label>
              <Textarea
                value={msgTemplate}
                onChange={e => setMsgTemplate(e.target.value)}
                rows={5}
                className="resize-none text-right"
                dir="rtl"
              />
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground">
              💡 سيفتح واتساب محادثة منفصلة لكل عميل — راجع الرسالة قبل الإرسال.
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => setWhatsappOpen(false)}>إلغاء</Button>
            <Button onClick={sendMessages} className="bg-[#25D366] hover:bg-[#20bb5a] text-white gap-2">
              <Send className="w-4 h-4" />
              إرسال ({selectedIds.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}