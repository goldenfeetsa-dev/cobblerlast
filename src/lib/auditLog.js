// ─────────────────────────────────────────────────────────────────
// سجل التدقيق الموحّد — مصدر واحد لتسجيل أي حركة حساسة بالنظام
// ─────────────────────────────────────────────────────────────────
// كان جدول audit_logs موجوداً بالفعل بقاعدة البيانات، لكن ما كان
// يُكتب فيه أي شي غير أخطاء الواجهة (ErrorBoundary) — يعني "لوحة
// التدقيق" فعلياً ما كانت تعرض أي حركة مستخدم حقيقية (من عدّل، من
// حذف، من غيّر سعر...)، فقط جدول مالي للطلبات والفواتير.
//
// هذا الملف يوفر دالة واحدة بسيطة تُستدعى من أي صفحة عشان تسجّل:
// - مين سوّى الحركة (اسم الموظف + دوره)
// - أي صفحة/قسم صارت فيه الحركة
// - أي نوع حركة (إنشاء/تعديل/حذف/تغيير حالة...)
// - على أي عنصر بالضبط (نوعه ومعرّفه)
// - أي تفاصيل إضافية مفيدة للمراجعة (القيمة قبل/بعد مثلاً)
//
// الاستخدام لا يوقف العملية الأساسية أبداً حتى لو فشل التسجيل نفسه —
// تسجيل التدقيق ثانوي ولا يجوز يمنع حفظ عمل المستخدم.
import { base44 } from '@/api/supabaseApi';
import { getSession } from '@/lib/sessionStore';

export async function logAudit({ action, page, entity, entity_id, details }) {
  try {
    const session = getSession();
    await base44.entities.AuditLog.create({
      action,                              // مثال: 'create' | 'update' | 'delete' | 'status_change'
      page: page || null,                  // مثال: '/employees' أو 'الموظفون'
      entity: entity || null,              // مثال: 'order' | 'employee' | 'customer' | 'working_hours'
      entity_id: entity_id || null,
      employee_name: session?.name || null,
      employee_role: session?.role || null,
      branch_id: session?.branch_id || null,
      new_value: details || null,
    });
  } catch {
    // تسجيل التدقيق ثانوي — أي فشل هنا (شبكة، عمود غير موجود...) ما يوقف
    // العملية الأساسية للمستخدم أبداً
  }
}
