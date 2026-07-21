import React, { useState } from 'react';
import { db } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { isFullAdmin, getHomePath } from '@/lib/roles';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { UserCog, Plus, Pencil, Trash2, Shield, User } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLog';


const ROLE_LABELS = {
  owner:      { label: 'مالك',     color: 'bg-purple-100 text-purple-700' },
  manager:    { label: 'مدير',     color: 'bg-blue-100 text-blue-700' },
  admin:      { label: 'مدير',     color: 'bg-blue-100 text-blue-700' },
  accountant: { label: 'محاسب',   color: 'bg-green-100 text-green-700' },
  cashier:    { label: 'كاشير',   color: 'bg-amber-100 text-amber-700' },
  staff:      { label: 'عامل',    color: 'bg-gray-100 text-gray-700' },
};

export default function Employees() {
  const session = getSession();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form, setForm] = useState({ name: '', pin: '', role: 'staff', branch_id: '', branch_name: '' });

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => db.Employee.list(),
    initialData: [],
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => db.Branch.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.Employee.delete(id),
    onSuccess: (_, id) => {
      const emp = employees?.find(e => e.id === id);
      logAudit({ action: 'delete', page: 'الموظفون', entity: 'employee', entity_id: id, details: { name: emp?.name, role: emp?.role } });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('تم حذف الموظف');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingEmployee) {
        return db.Employee.update(editingEmployee.id, data);
      }
      return db.Employee.create(data);
    },
    onSuccess: (result, data) => {
      logAudit({
        action: editingEmployee ? 'update' : 'create',
        page: 'الموظفون', entity: 'employee', entity_id: editingEmployee?.id || result?.id,
        details: editingEmployee
          ? { name: data.name, role_before: editingEmployee.role, role_after: data.role }
          : { name: data.name, role: data.role },
      });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDialogOpen(false);
      setEditingEmployee(null);
      setForm({ name: '', pin: '', role: 'staff' });
      toast.success(editingEmployee ? 'تم تحديث الموظف' : 'تم إضافة الموظف');
    },
  });

  if (!isFullAdmin(session?.role)) return <Navigate to={getHomePath(session?.role)} replace />;

  const openEdit = (emp) => {
    setEditingEmployee(emp);
    setForm({ name: emp.name, pin: emp.pin, role: emp.role, branch_id: emp.branch_id || '', branch_name: emp.branch_name || '' });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingEmployee(null);
    setForm({ name: '', pin: '', role: 'staff', branch_id: '', branch_name: '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.pin || form.pin.length !== 4) {
      toast.error('الاسم ورقم PIN مطلوبان');
      return;
    }
    saveMutation.mutate({ name: form.name, pin: form.pin, role: form.role, is_active: true, branch_id: form.branch_id || null, branch_name: form.branch_name });
  };

  const onBranchChange = (branchId) => {
    const branch = branches.find(b => b.id === branchId);
    setForm(p => ({ ...p, branch_id: branchId, branch_name: branch?.name || '' }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserCog className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">الموظفون</h1>
            <p className="text-sm text-muted-foreground">{employees.length} موظف</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 ml-2" />
              إضافة موظف
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'تعديل موظف' : 'إضافة موظف'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الموظف" />
              </div>
              <div className="space-y-2">
                <Label>رقم PIN (4 أرقام)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  value={form.pin}
                  onChange={e => { if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) setForm(p => ({ ...p, pin: e.target.value })); }}
                  placeholder="••••"
                  maxLength={4}
                  className="font-mono text-center text-2xl tracking-[0.5em]"
                />
              </div>
              <div className="space-y-2">
                <Label>الصلاحية</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">مالك — كامل الصلاحيات</SelectItem>
                    <SelectItem value="manager">مدير — يرى كل الفروع</SelectItem>
                    <SelectItem value="accountant">محاسب — يرى التقارير المالية</SelectItem>
                    <SelectItem value="cashier">كاشير — مبيعات وطلبات</SelectItem>
                    <SelectItem value="staff">عامل — يرى مهامه فقط بدون أسعار</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الفرع</Label>
                <Select value={form.branch_id || 'none'} onValueChange={v => onBranchChange(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— كل الفروع (مدير عام)</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">الموظف سيرى فقط طلبات فرعه</p>
              </div>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full bg-primary hover:bg-primary/90">
                {saveMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map(emp => (
            <Card key={emp.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${emp.role === 'admin' ? 'bg-primary/10' : 'bg-secondary'}`}>
                      {emp.role === 'admin' ? <Shield className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <h3 className="font-bold">{emp.name}</h3>
                      <Badge variant="outline" className="text-[10px] capitalize">{emp.role}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(emp)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف {emp.name}؟</AlertDialogTitle>
                          <AlertDialogDescription>لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(emp.id)} className="bg-destructive hover:bg-destructive/90">
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{emp.total_orders || 0} طلب</span>
                  <span>{(emp.total_revenue || 0).toFixed(0)} ر.س</span>
                </div>
                {emp.role && (
                  <Badge variant="outline" className={`text-[10px] ${(ROLE_LABELS[emp.role]||ROLE_LABELS.staff).color}`}>
                    {(ROLE_LABELS[emp.role]||ROLE_LABELS.staff).label}
                  </Badge>
                )}
                {emp.branch_name && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                      🏪 {emp.branch_name}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}