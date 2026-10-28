import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../models/order.dart';
import '../pos_ui.dart';

/// المرتجعات — نفس /returns: البحث برقم الطلب/الفاتورة ثم إصدار إشعار دائن
/// (مرتجع) أو مدين رسمي يُرسل لزاتكا، وسجل الإشعارات.
class ReturnsScreen extends StatefulWidget {
  const ReturnsScreen({super.key});

  @override
  State<ReturnsScreen> createState() => _ReturnsScreenState();
}

class _ReturnsScreenState extends State<ReturnsScreen> {
  final _code = TextEditingController();
  final _reason = TextEditingController();
  final _amount = TextEditingController();
  ({String type, Map<String, dynamic> rec})? _found;
  String? _searchError;
  bool _searching = false;
  bool _issuing = false;
  String _noteType = 'credit';
  List<Map<String, dynamic>>? _notes;

  @override
  void initState() {
    super.initState();
    _loadNotes();
  }

  @override
  void dispose() {
    _code.dispose();
    _reason.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _loadNotes() async {
    try {
      final r = await context.read<ApiClient>().request('GET', '/api/secure/zatca', query: {'resource': 'notes'});
      if (mounted) setState(() => _notes = r is List ? r.whereType<Map>().map((m) => m.map((k, v) => MapEntry('$k', v))).toList() : const []);
    } on ApiException {
      if (mounted) setState(() => _notes = const []);
    }
  }

  Future<void> _search() async {
    final code = _code.text.trim().replaceAll(RegExp(r'-\d+$'), '');
    if (code.isEmpty) return;
    final rest = context.read<Rest>();
    setState(() {
      _searching = true;
      _searchError = null;
      _found = null;
    });
    try {
      final o = await rest.select('orders', filters: {'order_number': 'eq.$code'}, order: 'created_at.desc', limit: 1);
      if (o.isNotEmpty) {
        setState(() => _found = (type: 'order', rec: o.first));
        _amount.text = '${o.first['total_price'] ?? ''}';
        return;
      }
      final s = await rest.select('sales_invoices', filters: {'invoice_number': 'eq.$code'}, order: 'created_at.desc', limit: 1);
      if (s.isNotEmpty) {
        setState(() => _found = (type: 'sale', rec: s.first));
        _amount.text = '${s.first['total'] ?? ''}';
        return;
      }
      setState(() => _searchError = 'ما فيه طلب ولا فاتورة برقم $code');
    } on ApiException catch (e) {
      setState(() => _searchError = e.message);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _issue() async {
    final f = _found;
    final amount = double.tryParse(_amount.text) ?? 0;
    if (f == null || amount <= 0 || _reason.text.trim().isEmpty) {
      toast(context, 'السبب والمبلغ مطلوبان', error: true);
      return;
    }
    setState(() => _issuing = true);
    try {
      final r = await context.read<ApiClient>().request('POST', '/api/secure/zatca', query: {'resource': 'notes'}, data: {
        'noteType': _noteType,
        'originalRecordType': f.type,
        'originalRecordId': f.rec['id'],
        'reason': _reason.text.trim(),
        'amount': amount,
      });
      if (!mounted) return;
      final no = r is Map ? (r['note'] is Map ? r['note']['note_number'] : null) : null;
      toast(context, '✅ تم إصدار ${_noteType == 'credit' ? 'المرتجع' : 'إشعار المدين'} رقم ${no ?? ''} وإرساله لزاتكا');
      setState(() {
        _found = null;
        _code.clear();
        _reason.clear();
        _amount.clear();
      });
      _loadNotes();
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل إصدار المرتجع: ${e.message}', error: true);
    } finally {
      if (mounted) setState(() => _issuing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final f = _found;
    final reported = f != null && {'REPORTED', 'CLEARED'}.contains(f.rec['zatca_status']);
    return RefreshIndicator(
      onRefresh: _loadNotes,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const PageHeader(title: 'المرتجعات', subtitle: 'ابحث برقم الطلب أو الفاتورة، وأصدر مرتجع (إشعار دائن) رسمي يُرسل تلقائياً لزاتكا', icon: Icons.undo_rounded, tone: Tone.red),
          GlassCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text('١. ابحث عن الفاتورة أو الطلب', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _code,
                    textDirection: TextDirection.ltr,
                    onSubmitted: (_) => _search(),
                    decoration: const InputDecoration(hintText: 'رقم الطلب أو رقم الفاتورة'),
                  ),
                ),
                const SizedBox(width: 8),
                PrimaryButton(label: 'بحث', icon: Icons.search_rounded, busy: _searching, onPressed: _search),
              ]),
              if (_searchError != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_searchError!, style: const TextStyle(color: Pos.red))),
            ]),
          ),
          if (f != null) ...[
            const SizedBox(height: 12),
            GlassCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Text('٢. إصدار الإشعار', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Wrap(spacing: 8, runSpacing: 6, children: [
                  SoftBadge(f.type == 'order' ? 'طلب إصلاح' : 'فاتورة منتج', Pos.primary),
                  SoftBadge('${f.rec['order_number'] ?? f.rec['invoice_number']}', Pos.muted),
                  SoftBadge('${f.rec['customer_name'] ?? 'عميل'}', Pos.muted),
                  SoftBadge(reported ? 'مُبلَّغة لزاتكا' : 'غير مُبلَّغة بعد', reported ? Pos.green : Pos.amber),
                ]),
                const SizedBox(height: 4),
                Text(fmtDateTime(DateTime.tryParse('${f.rec['created_at']}')?.toLocal()), style: const TextStyle(fontSize: 12, color: Pos.muted)),
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'credit', label: Text('مرتجع (إشعار دائن)')),
                    ButtonSegment(value: 'debit', label: Text('إشعار مدين')),
                  ],
                  selected: {_noteType},
                  showSelectedIcon: false,
                  onSelectionChanged: (v) => setState(() => _noteType = v.first),
                ),
                const SizedBox(height: 10),
                TextField(
                    controller: _amount,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'المبلغ شامل الضريبة')),
                const SizedBox(height: 10),
                TextField(controller: _reason, maxLines: 2, decoration: const InputDecoration(labelText: 'السبب *')),
                const SizedBox(height: 12),
                PrimaryButton(
                  label: _noteType == 'credit' ? 'إصدار المرتجع وإرساله لزاتكا' : 'إصدار إشعار المدين',
                  icon: Icons.send_rounded,
                  color: _noteType == 'credit' ? Pos.destructive : Pos.primary,
                  expand: true,
                  busy: _issuing,
                  onPressed: _issue,
                ),
              ]),
            ),
          ],
          const SizedBox(height: 18),
          const Text('سجل المرتجعات والإشعارات', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 8),
          if (_notes == null)
            const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator()))
          else if (_notes!.isEmpty)
            const EmptyState(icon: Icons.receipt_long_outlined, text: 'لا توجد مرتجعات بعد')
          else
            GlassCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                for (final n in _notes!)
                  ListTile(
                    title: Text('${n['note_number'] ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${n['reason'] ?? ''} · ${fmtDateTime(DateTime.tryParse('${n['created_at']}')?.toLocal())}', maxLines: 1, overflow: TextOverflow.ellipsis),
                    trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                      PosMoney(((n['amount'] as num?) ?? 0) * (n['note_type'] == 'credit' ? -1 : 1), weight: FontWeight.w700, color: n['note_type'] == 'credit' ? Pos.red : Pos.fg),
                      SoftBadge(n['note_type'] == 'credit' ? 'دائن' : 'مدين', n['note_type'] == 'credit' ? Pos.red : Pos.primary),
                    ]),
                  ),
              ]),
            ),
        ],
      ),
    );
  }
}
