import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../models/order.dart';
import '../pos_ui.dart';
import 'content_screens.dart' show ImageUploadField;
import 'settings_screens.dart' show confirmDelete;

String _err(ApiException e) => e.status == 403 ? 'ليس لديك صلاحية لهذا الإجراء' : e.message;
Map<String, dynamic> _m(Object? v) => v is Map ? v.map((k, x) => MapEntry('$k', x)) : <String, dynamic>{};

// ───────────────────────── الوظائف الشاغرة ─────────────────────────

const _empLabels = {'full_time': 'دوام كامل', 'part_time': 'دوام جزئي', 'contract': 'عقد مؤقت'};
const _applyLabels = {'whatsapp': 'واتساب', 'email': 'إيميل', 'phone': 'اتصال', 'link': 'رابط خارجي'};

String _slugify(String title) {
  final base = title.trim().replaceAll(RegExp(r'[^؀-ۿa-zA-Z0-9\s-]'), '').replaceAll(RegExp(r'\s+'), '-').toLowerCase();
  final t = DateTime.now().millisecondsSinceEpoch.toRadixString(36);
  return '${base.isEmpty ? 'job' : base}-${t.substring(t.length - 5)}';
}

/// إدارة الوظائف — نفس /admin/careers: نشر/تعديل/حذف وظيفة + المتقدمون (ATS).
class CareersAdminScreen extends StatefulWidget {
  const CareersAdminScreen({super.key});
  @override
  State<CareersAdminScreen> createState() => _CareersAdminScreenState();
}

class _CareersAdminScreenState extends State<CareersAdminScreen> {
  List<Map<String, dynamic>>? _rows;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('job_postings', order: 'created_at.desc', limit: 200);
      if (mounted) {
        setState(() {
          _rows = r;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _edit([Map<String, dynamic>? j]) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => _JobDialog(job: j));
    if (ok == true) _load();
  }

  Future<void> _delete(Map<String, dynamic> j) async {
    if (!await confirmDelete(context, 'تأكيد الحذف', 'هل تريد حذف وظيفة "${j['title']}"؟')) return;
    if (!mounted) return;
    try {
      await context.read<Rest>().delete('job_postings', '${j['id']}');
      if (mounted) toast(context, 'تم الحذف');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, _err(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows ?? const <Map<String, dynamic>>[];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(
            title: 'إدارة الوظائف الشاغرة',
            subtitle: 'الوظائف المفعّلة تظهر تلقائياً بصفحة الوظائف العامة وتُفهرس بجوجل',
            icon: Icons.work_outline_rounded,
            tone: Tone.indigo,
            trailing: PrimaryButton(label: 'نشر وظيفة', icon: Icons.add_rounded, onPressed: () => _edit()),
          ),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (rows.isEmpty)
            const EmptyState(icon: Icons.work_off_outlined, text: 'ما فيه وظائف منشورة', sub: 'اضغط "نشر وظيفة" لإضافة أول وظيفة')
          else
            LayoutBuilder(builder: (context, c) {
              final w = c.maxWidth >= 760 ? (c.maxWidth - 10) / 2 : c.maxWidth;
              return Wrap(spacing: 10, runSpacing: 10, children: [
                for (final j in rows)
                  SizedBox(
                    width: w,
                    child: Opacity(
                      opacity: j['is_active'] == false ? .6 : 1,
                      child: GlassCard(
                        padding: const EdgeInsets.all(14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                            Text('${j['title'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
                            if (j['is_active'] == false) const SoftBadge('غير منشورة', Pos.muted),
                            SoftBadge(_empLabels[j['employment_type']] ?? '${j['employment_type'] ?? ''}', const Color(0xFFB45309)),
                          ]),
                          if ((j['department'] ?? '').toString().isNotEmpty) Text('${j['department']}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                          const SizedBox(height: 6),
                          Wrap(spacing: 12, runSpacing: 4, children: [
                            if ((j['location'] ?? '').toString().isNotEmpty) Text('${j['location']}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                            if ((j['salary_note'] ?? '').toString().isNotEmpty) Text('${j['salary_note']}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                            Text('التقديم: ${_applyLabels[j['apply_method']] ?? ''}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                          ]),
                          const SizedBox(height: 8),
                          Row(children: [
                            OutlineSmall(
                              label: 'المتقدمون',
                              icon: Icons.people_alt_outlined,
                              onPressed: () => showDialog<void>(context: context, builder: (_) => _ApplicantsDialog(job: j)),
                            ),
                            const Spacer(),
                            IconButton(onPressed: () => _edit(j), icon: const Icon(Icons.edit_outlined, size: 18)),
                            IconButton(onPressed: () => _delete(j), icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Pos.destructive)),
                          ]),
                        ]),
                      ),
                    ),
                  ),
              ]);
            }),
        ],
      ),
    );
  }
}

class _JobDialog extends StatefulWidget {
  const _JobDialog({this.job});
  final Map<String, dynamic>? job;
  @override
  State<_JobDialog> createState() => _JobDialogState();
}

class _JobDialogState extends State<_JobDialog> {
  static const _keys = ['title', 'department', 'location', 'description', 'requirements', 'title_en', 'description_en', 'keywords', 'salary_note', 'apply_value'];
  late final _f = {for (final k in _keys) k: TextEditingController(text: '${widget.job?[k] ?? (k == 'apply_value' ? '966549678191' : '')}')};
  late String _type = _empLabels.containsKey(widget.job?['employment_type']) ? '${widget.job!['employment_type']}' : 'full_time';
  late String _apply = _applyLabels.containsKey(widget.job?['apply_method']) ? '${widget.job!['apply_method']}' : 'whatsapp';
  late bool _active = widget.job?['is_active'] != false;
  bool _saving = false;

  Future<void> _save() async {
    if (_f['title']!.text.trim().isEmpty) {
      toast(context, 'المسمى الوظيفي مطلوب', error: true);
      return;
    }
    final row = <String, dynamic>{
      for (final k in _keys) k: _f[k]!.text.trim(),
      'employment_type': _type,
      'apply_method': _apply,
      'is_active': _active,
    };
    final rest = context.read<Rest>();
    setState(() => _saving = true);
    try {
      if (widget.job == null) {
        await rest.insert('job_postings', {...row, 'slug': _slugify(row['title'] as String)}, select: 'id');
      } else {
        await rest.update('job_postings', '${widget.job!['id']}', row, select: 'id');
      }
      if (!mounted) return;
      toast(context, widget.job == null ? 'تم نشر الوظيفة' : 'تم تحديث الوظيفة');
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, 'صار خطأ: ${_err(e)}', error: true);
        setState(() => _saving = false);
      }
    }
  }

  Widget _tf(String k, String label, {String? hint, int lines = 1, bool ltr = false, String? helper}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(
          controller: _f[k],
          minLines: lines,
          maxLines: lines == 1 ? 1 : 6,
          textDirection: ltr ? TextDirection.ltr : null,
          decoration: InputDecoration(labelText: label, hintText: hint, helperText: helper, helperMaxLines: 2),
        ),
      );

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.job == null ? 'نشر وظيفة جديدة' : 'تعديل الوظيفة'),
        content: SizedBox(
          width: 520,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _tf('title', 'المسمى الوظيفي *', hint: 'مثال: فني إصلاح أحذية'),
              Row(children: [
                Expanded(child: _tf('department', 'القسم', hint: 'مثال: الورشة')),
                const SizedBox(width: 10),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: DropdownButtonFormField<String>(
                      value: _type,
                      decoration: const InputDecoration(labelText: 'نوع الدوام'),
                      items: [for (final e in _empLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
                      onChanged: (v) => setState(() => _type = v ?? 'full_time'),
                    ),
                  ),
                ),
              ]),
              _tf('location', 'الموقع / الفرع', hint: 'مثال: الرياض - فرع العليا'),
              _tf('description', 'مهام الوظيفة (سطر لكل مهمة — تظهر للزوار)', hint: 'نبذة عن المهام والمسؤوليات', lines: 3),
              _tf('requirements', 'المتطلبات (داخلية — لا تظهر للزوار)', hint: 'كل شرط بسطر مستقل', lines: 3),
              _tf('title_en', 'المسمى بالإنجليزية (للنسخة الإنجليزية وجوجل)', hint: 'Bag Repair Technician', ltr: true),
              _tf('description_en', 'المهام بالإنجليزية (سطر لكل مهمة)', lines: 3, ltr: true),
              _tf('keywords', 'كلمات تحليل السيرة (ATS)',
                  lines: 2, hint: 'جلد/leather, خياطة/sewing/stitching', helper: 'افصل بين الكلمات بفاصلة، والمرادفات بـ / — إن تُركت فارغة تُستخرج الكلمات تلقائياً من المهام.'),
              _tf('salary_note', 'الراتب (داخلي فقط — لا يظهر للزوار)', hint: 'مثال: 4000 - 5500 ريال أو يُحدد بعد المقابلة'),
              Row(children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: DropdownButtonFormField<String>(
                      value: _apply,
                      decoration: const InputDecoration(labelText: 'طريقة التقديم'),
                      items: [for (final e in _applyLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
                      onChanged: (v) => setState(() => _apply = v ?? 'whatsapp'),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _tf('apply_value', switch (_apply) { 'whatsapp' => 'رقم الواتساب (966...)', 'email' => 'الإيميل', 'phone' => 'رقم الجوال', _ => 'الرابط' }, ltr: true),
                ),
              ]),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _active,
                onChanged: (v) => setState(() => _active = v),
                title: Text(_active ? 'منشورة وظاهرة للزوار' : 'مسودة (مخفية)'),
              ),
            ]),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          PrimaryButton(label: 'حفظ ونشر', busy: _saving, onPressed: _save),
        ],
      );
}

const _appStatus = {'new': 'جديد', 'shortlisted': 'مرشّح', 'interview': 'مقابلة', 'rejected': 'مرفوض', 'hired': 'تم التوظيف'};

class _ApplicantsDialog extends StatefulWidget {
  const _ApplicantsDialog({required this.job});
  final Map<String, dynamic> job;
  @override
  State<_ApplicantsDialog> createState() => _ApplicantsDialogState();
}

class _ApplicantsDialogState extends State<_ApplicantsDialog> {
  List<Map<String, dynamic>>? _rows;
  String? _error;

  ApiClient get _api => context.read<ApiClient>();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _api.request('GET', '/api/secure/data', query: {'resource': 'applications', 'job_id': '${widget.job['id']}'});
      if (mounted) setState(() => _rows = r is List ? r.map(_m).toList() : const []);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = _err(e));
    }
  }

  Future<void> _status(Map<String, dynamic> a, String s) async {
    try {
      await _api.request('PATCH', '/api/secure/data', query: {'resource': 'applications', 'id': '${a['id']}'}, data: {'status': s});
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, _err(e), error: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> a) async {
    if (!await confirmDelete(context, 'حذف الطلب والسيرة نهائياً؟')) return;
    if (!mounted) return;
    try {
      await _api.request('DELETE', '/api/secure/data', query: {'resource': 'applications', 'id': '${a['id']}'});
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, _err(e), error: true);
    }
  }

  Future<void> _cv(Map<String, dynamic> a) async {
    try {
      final r = await _api.request('GET', '/api/secure/data', query: {'resource': 'applications', 'op': 'cv', 'id': '${a['id']}'});
      final url = r is Map ? '${r['url'] ?? ''}' : '';
      if (url.isNotEmpty) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message.contains('no_cv') ? 'لا توجد سيرة مرفقة' : _err(e), error: true);
    }
  }

  static Color _score(num s) => s >= 70 ? const Color(0xFF047857) : s >= 40 ? const Color(0xFFB45309) : const Color(0xFFB91C1C);

  @override
  Widget build(BuildContext context) {
    final rows = _rows ?? const <Map<String, dynamic>>[];
    return AlertDialog(
      title: Text('المتقدمون — ${widget.job['title']} (${rows.length})'),
      content: SizedBox(
        width: 620,
        child: _error != null
            ? Text(_error!, style: const TextStyle(color: Pos.red))
            : _rows == null
                ? const SizedBox(height: 120, child: Center(child: CircularProgressIndicator()))
                : rows.isEmpty
                    ? const Padding(padding: EdgeInsets.all(30), child: Text('لا يوجد متقدمون بعد', textAlign: TextAlign.center, style: TextStyle(color: Pos.muted)))
                    : ListView(shrinkWrap: true, children: [
                        for (final a in rows)
                          Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(border: Border.all(color: Pos.border), borderRadius: BorderRadius.circular(12)),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Expanded(
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text('${a['full_name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
                                    Text(
                                      [if (a['city'] != null) a['city'], if (a['years_experience'] != null) '${a['years_experience']} سنة خبرة', if (a['email'] != null) a['email']].join(' · '),
                                      style: const TextStyle(fontSize: 12, color: Pos.muted),
                                    ),
                                  ]),
                                ),
                                Column(children: [
                                  Text('${a['ats_score'] ?? 0}%', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: _score((a['ats_score'] as num?) ?? 0))),
                                  const Text('مطابقة ATS', style: TextStyle(fontSize: 10, color: Pos.muted)),
                                ]),
                              ]),
                              if ((a['about'] ?? '').toString().isNotEmpty)
                                Container(
                                  width: double.infinity,
                                  margin: const EdgeInsets.only(top: 6),
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(color: Pos.muted.withValues(alpha: .06), borderRadius: BorderRadius.circular(8)),
                                  child: Text('${a['about']}', style: const TextStyle(fontSize: 12)),
                                ),
                              if ((a['ats_matched'] as List?)?.isNotEmpty ?? false)
                                Text('تحقق: ${(a['ats_matched'] as List).join('، ')}', style: const TextStyle(fontSize: 12, color: Color(0xFF047857))),
                              if ((a['ats_missing'] as List?)?.isNotEmpty ?? false)
                                Text('ناقص: ${(a['ats_missing'] as List).join('، ')}', style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C))),
                              const SizedBox(height: 6),
                              Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                                TextButton.icon(
                                  onPressed: () => launchUrl(Uri.parse('tel:${a['phone']}')),
                                  icon: const Icon(Icons.phone_outlined, size: 15),
                                  label: Text('${a['phone'] ?? ''}', textDirection: TextDirection.ltr),
                                ),
                                if (a['cv_path'] != null) OutlineSmall(label: 'السيرة', icon: Icons.description_outlined, onPressed: () => _cv(a)),
                                DropdownButton<String>(
                                  value: _appStatus.containsKey(a['status']) ? '${a['status']}' : 'new',
                                  isDense: true,
                                  items: [for (final e in _appStatus.entries) DropdownMenuItem(value: e.key, child: Text(e.value, style: const TextStyle(fontSize: 13)))],
                                  onChanged: (v) => v == null ? null : _status(a, v),
                                ),
                                IconButton(onPressed: () => _delete(a), icon: const Icon(Icons.delete_outline_rounded, color: Pos.destructive, size: 19)),
                              ]),
                            ]),
                          ),
                      ]),
      ),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('إغلاق'))],
    );
  }
}

// ───────────────────────── سوق المزاد ─────────────────────────

const _auctionCats = {'bags': 'حقائب', 'shoes': 'أحذية', 'accessories': 'إكسسوارات', 'other': 'أخرى'};
const _auctionStatus = {'active': 'نشط', 'pending': 'بانتظار المراجعة', 'ended': 'منتهي', 'sold': 'مباع', 'cancelled': 'ملغي'};

/// إدارة سوق المزاد — نفس /admin/auction: القطع، الحالة، المزايدات، إعادة الفتح.
class AuctionAdminScreen extends StatefulWidget {
  const AuctionAdminScreen({super.key});
  @override
  State<AuctionAdminScreen> createState() => _AuctionAdminScreenState();
}

class _AuctionAdminScreenState extends State<AuctionAdminScreen> {
  List<Map<String, dynamic>>? _rows;
  List<Map<String, dynamic>> _brands = const [];
  String? _error, _bidsFor;
  List<Map<String, dynamic>>? _bids;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rest = context.read<Rest>();
    try {
      final r = await Future.wait<dynamic>([
        rest.secureList('auction_listings', limit: 200),
        rest.rpc('auction_submitters').catchError((_) => const []),
        rest.select('brands', order: 'sort_order.asc', limit: 100).catchError((_) => <Map<String, dynamic>>[]),
      ]);
      final subs = {for (final s in (r[1] is List ? r[1] as List : const []).map(_m)) '${s['id']}': s};
      if (!mounted) return;
      setState(() {
        _rows = [
          for (final l in r[0] as List<Map<String, dynamic>>)
            subs.containsKey('${l['id']}') ? {...l, 'submitter_name': subs['${l['id']}']!['name'], 'submitter_phone': subs['${l['id']}']!['phone']} : l,
        ];
        _brands = r[2] as List<Map<String, dynamic>>;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _patch(Map<String, dynamic> l, Map<String, dynamic> p) async {
    try {
      await context.read<Rest>().securePatch('auction_listings', '${l['id']}', p);
      if (mounted) toast(context, 'تم التحديث');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل التحديث: ${_err(e)}', error: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> l) async {
    if (!await confirmDelete(context, 'حذف ${l['title_ar'] ?? 'القطعة'}؟')) return;
    if (!mounted) return;
    try {
      await context.read<ApiClient>().request('DELETE', '/api/secure/data', query: {'resource': 'auction_listings', 'id': '${l['id']}'});
      if (mounted) toast(context, 'تم حذف القطعة');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل حذف القطعة: ${_err(e)}', error: true);
    }
  }

  Future<void> _toggleBids(Map<String, dynamic> l) async {
    final id = '${l['id']}';
    if (_bidsFor == id) {
      setState(() => _bidsFor = null);
      return;
    }
    setState(() {
      _bidsFor = id;
      _bids = null;
    });
    try {
      final r = await context.read<Rest>().rpc('auction_bids_admin', {'p_listing': id});
      if (mounted && _bidsFor == id) setState(() => _bids = r is List ? r.map(_m).toList() : const []);
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, _err(e), error: true);
        setState(() => _bids = const []);
      }
    }
  }

  Future<void> _edit([Map<String, dynamic>? l]) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => _ListingDialog(listing: l, brands: _brands));
    if (ok == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows ?? const <Map<String, dynamic>>[];
    final now = DateTime.now();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(
            title: 'إدارة سوق المزاد',
            subtitle: '${rows.length} قطعة',
            icon: Icons.gavel_rounded,
            tone: Tone.purple,
            trailing: PrimaryButton(label: 'إضافة قطعة مزاد', icon: Icons.add_rounded, onPressed: () => _edit()),
          ),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (rows.isEmpty)
            const EmptyState(icon: Icons.gavel_outlined, text: 'لا توجد قطع مزاد بعد')
          else
            for (final l in rows) ...[
              GlassCard(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(children: [
                    Container(
                      width: 56,
                      height: 56,
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), color: Pos.muted.withValues(alpha: .08)),
                      child: (l['image_url'] ?? '').toString().isEmpty
                          ? const Icon(Icons.gavel_rounded, color: Pos.muted)
                          : Image.network('${l['image_url']}', fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                          Text('${l['title_ar'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                          if (l['is_featured'] == true) const Icon(Icons.star_rounded, size: 15, color: Color(0xFFEAB308)),
                          SoftBadge(_auctionCats[l['category']] ?? '${l['category'] ?? ''}', Pos.muted),
                          SoftBadge(_auctionStatus[l['status']] ?? '${l['status'] ?? ''}', l['status'] == 'active' ? Pos.green : l['status'] == 'pending' ? Pos.red : Pos.muted),
                        ]),
                        Row(children: [
                          const Text('السعر الحالي: ', style: TextStyle(fontSize: 12, color: Pos.muted)),
                          PosMoney(((l['current_price'] as num?) ?? 0).toDouble(), size: 12.5, weight: FontWeight.w800, color: Pos.primary),
                          Flexible(child: Text(' · ينتهي: ${fmtDateTime(DateTime.tryParse('${l['ends_at']}')?.toLocal())}', style: const TextStyle(fontSize: 12, color: Pos.muted), overflow: TextOverflow.ellipsis)),
                        ]),
                        if (l['submitter_name'] != null)
                          Text('مقدَّمة من: ${l['submitter_name']} — ${l['submitter_phone'] ?? ''}', style: const TextStyle(fontSize: 11.5, color: Color(0xFFB45309))),
                      ]),
                    ),
                  ]),
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    l['status'] == 'active'
                        ? OutlineSmall(label: 'إنهاء', onPressed: () => _patch(l, {'status': 'ended'}))
                        : OutlineSmall(label: 'تفعيل', onPressed: () => _patch(l, {'status': 'active'})),
                    OutlineSmall(label: 'المزايدات', icon: Icons.list_alt_rounded, onPressed: () => _toggleBids(l)),
                    if ((DateTime.tryParse('${l['ends_at']}') ?? now).isBefore(now))
                      OutlineSmall(
                        label: 'إعادة فتح 24 ساعة',
                        icon: Icons.restart_alt_rounded,
                        onPressed: () => _patch(l, {'status': 'active', 'ends_at': DateTime.now().toUtc().add(const Duration(hours: 24)).toIso8601String()}),
                      ),
                    IconButton(onPressed: () => _edit(l), icon: const Icon(Icons.edit_outlined, size: 18)),
                    IconButton(onPressed: () => _delete(l), icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Pos.destructive)),
                  ]),
                  if (_bidsFor == '${l['id']}')
                    Container(
                      margin: const EdgeInsets.only(top: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(border: Border.all(color: Pos.border), borderRadius: BorderRadius.circular(10)),
                      child: _bids == null
                          ? const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
                          : _bids!.isEmpty
                              ? const Text('لا توجد مزايدات', style: TextStyle(color: Pos.muted, fontSize: 13))
                              : Column(children: [
                                  for (final b in _bids!)
                                    Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 3),
                                      child: Row(children: [
                                        Expanded(child: Text('${b['bidder_name'] ?? ''} — ${b['bidder_phone'] ?? ''}', style: const TextStyle(fontSize: 13))),
                                        PosMoney(((b['amount'] as num?) ?? 0).toDouble(), weight: FontWeight.w800),
                                      ]),
                                    ),
                                ]),
                    ),
                ]),
              ),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }
}

class _ListingDialog extends StatefulWidget {
  const _ListingDialog({this.listing, required this.brands});
  final Map<String, dynamic>? listing;
  final List<Map<String, dynamic>> brands;
  @override
  State<_ListingDialog> createState() => _ListingDialogState();
}

class _ListingDialogState extends State<_ListingDialog> {
  Map<String, dynamic>? get l => widget.listing;
  late final _titleAr = TextEditingController(text: '${l?['title_ar'] ?? ''}');
  late final _title = TextEditingController(text: '${l?['title'] ?? ''}');
  late final _start = TextEditingController(text: l?['starting_price'] == null ? '' : '${l!['starting_price']}');
  late final _inc = TextEditingController(text: '${l?['bid_increment'] ?? 10}');
  late final _cond = TextEditingController(text: '${l?['condition'] ?? 'مزاد نشط'}');
  late final _desc = TextEditingController(text: '${l?['description_ar'] ?? ''}');
  late String _cat = _auctionCats.containsKey(l?['category']) ? '${l!['category']}' : 'bags';
  late String? _brand = l?['brand_id']?.toString();
  late String _img = '${l?['image_url'] ?? ''}';
  late bool _featured = l?['is_featured'] == true;
  late DateTime _ends = DateTime.tryParse('${l?['ends_at']}')?.toLocal() ?? DateTime.now().add(const Duration(hours: 4));
  bool _saving = false;

  Future<void> _pickEnds() async {
    final d = await showDatePicker(context: context, firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now().add(const Duration(days: 365)), initialDate: _ends);
    if (d == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_ends));
    if (t == null) return;
    setState(() => _ends = DateTime(d.year, d.month, d.day, t.hour, t.minute));
  }

  Future<void> _save() async {
    final start = double.tryParse(_start.text);
    if (_titleAr.text.trim().isEmpty || start == null) {
      toast(context, 'اسم القطعة والسعر الابتدائي مطلوبان', error: true);
      return;
    }
    final row = <String, dynamic>{
      'title': _title.text.trim().isEmpty ? _titleAr.text.trim() : _title.text.trim(),
      'title_ar': _titleAr.text.trim(),
      'description_ar': _desc.text.trim().isEmpty ? null : _desc.text.trim(),
      'category': _cat,
      'condition': _cond.text.trim().isEmpty ? 'مزاد نشط' : _cond.text.trim(),
      'brand_id': _brand,
      'starting_price': start,
      'current_price': l?['current_price'] != null ? (l!['current_price'] as num).toDouble() : start,
      'bid_increment': double.tryParse(_inc.text) ?? 10,
      'image_url': _img.isEmpty ? null : _img,
      'ends_at': _ends.toUtc().toIso8601String(),
      'is_featured': _featured,
      'sort_order': (l?['sort_order'] as num?)?.toInt() ?? 0,
    };
    final rest = context.read<Rest>();
    setState(() => _saving = true);
    try {
      if (l == null) {
        await rest.securePost('auction_listings', {...row, 'status': 'active'});
      } else {
        await rest.securePatch('auction_listings', '${l!['id']}', row);
      }
      if (!mounted) return;
      toast(context, l == null ? 'تمت إضافة قطعة المزاد' : 'تم تحديث القطعة');
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, '${l == null ? 'فشل إضافة القطعة' : 'فشل تعديل القطعة'}: ${_err(e)}', error: true);
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(l == null ? 'إضافة قطعة مزاد جديدة' : 'تعديل قطعة مزاد'),
        content: SizedBox(
          width: 500,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              TextField(controller: _titleAr, decoration: const InputDecoration(labelText: 'اسم القطعة بالعربي *', hintText: 'حقيبة جلد مجدّدة — تصميم فاخر')),
              const SizedBox(height: 10),
              TextField(controller: _title, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'الاسم بالإنجليزي', hintText: 'Refurbished Designer Handbag')),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _cat,
                    decoration: const InputDecoration(labelText: 'الفئة'),
                    items: [for (final e in _auctionCats.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
                    onChanged: (v) => setState(() => _cat = v ?? 'bags'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonFormField<String?>(
                    value: widget.brands.any((b) => '${b['id']}' == _brand) ? _brand : null,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'البراند'),
                    items: [
                      const DropdownMenuItem<String?>(value: null, child: Text('بدون براند محدد')),
                      for (final b in widget.brands) DropdownMenuItem<String?>(value: '${b['id']}', child: Text('${b['name_ar'] ?? b['name']}')),
                    ],
                    onChanged: (v) => setState(() => _brand = v),
                  ),
                ),
              ]),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: TextField(controller: _start, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'السعر الابتدائي (ر.س) *', hintText: '500'))),
                const SizedBox(width: 10),
                Expanded(child: TextField(controller: _inc, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'حد الزيادة لكل مزايدة'))),
              ]),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: OutlineSmall(label: 'ينتهي: ${fmtDateTime(_ends)}', icon: Icons.event_rounded, onPressed: _pickEnds)),
                const SizedBox(width: 10),
                Expanded(child: TextField(controller: _cond, decoration: const InputDecoration(labelText: 'حالة القطعة (نص وصفي)'))),
              ]),
              const SizedBox(height: 12),
              ImageUploadField(bucket: 'shop-products', label: 'صورة القطعة', url: _img, onChanged: (u) => setState(() => _img = u)),
              const SizedBox(height: 10),
              TextField(controller: _desc, decoration: const InputDecoration(labelText: 'الوصف', hintText: 'وصف مختصر لحالة القطعة وترميمها...')),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _featured,
                onChanged: (v) => setState(() => _featured = v ?? false),
                title: const Text('قطعة مميزة'),
                controlAffinity: ListTileControlAffinity.leading,
              ),
            ]),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          PrimaryButton(label: 'حفظ', busy: _saving, onPressed: _save),
        ],
      );
}
