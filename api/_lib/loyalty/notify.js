/**
 * إدراج إشعار داخل الموقع للعميل عند تغيّر نقاطه أو مستواه.
 */
export async function notifyMember(supabase, memberId, message, type = 'points_update') {
  const { error } = await supabase.from('loyalty_member_notifications').insert({
    member_id: memberId,
    message,
    type,
  });
  if (error) {
    // لا نُفشل العملية الأساسية بسبب فشل الإشعار — فقط نسجّل الخطأ
    console.error('loyalty notifyMember error:', error.message);
  }
}
