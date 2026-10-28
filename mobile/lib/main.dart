import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'core/api_client.dart';
import 'core/rest.dart';
import 'core/session_storage.dart';
import 'pos/pos_shell.dart';
import 'pos/pos_ui.dart';
import 'screens/login_screen.dart';
import 'state/accounting_controller.dart';
import 'state/auth_controller.dart';
import 'state/new_order_service.dart';
import 'state/order_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ar');
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarColor: Pos.bg,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));

  final storage = SessionStorage();
  final api = ApiClient(storage);
  final auth = AuthController(api, storage);
  // لا ننتظر — شاشة البدء تظهر فوراً أثناء التحقق من الجلسة
  auth.restore();

  runApp(AppProviders(api: api, auth: auth, child: const CobblerApp()));
}

/// كل الخدمات المشتركة — منفصلة حتى تستخدمها اختبارات لقطات الشاشة بنفس الشكل.
class AppProviders extends StatelessWidget {
  const AppProviders({super.key, required this.api, required this.auth, required this.child, this.accounting});
  final ApiClient api;
  final AuthController auth;
  final AccountingController? accounting;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final rest = Rest(api);
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        Provider<Rest>.value(value: rest),
        Provider<OrderService>.value(value: OrderService(rest, api)),
        Provider<NewOrderService>.value(value: NewOrderService(rest, api)),
        ChangeNotifierProvider<AuthController>.value(value: auth),
        if (accounting != null)
          ChangeNotifierProvider<AccountingController>.value(value: accounting!)
        else
          ChangeNotifierProvider<AccountingController>(create: (_) => AccountingController(api)),
      ],
      child: child,
    );
  }
}

class CobblerApp extends StatelessWidget {
  const CobblerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'إبرة وخيط الإسكافي',
      debugShowCheckedModeBanner: false,
      theme: Pos.theme(),
      locale: const Locale('ar', 'SA'),
      supportedLocales: const [Locale('ar', 'SA'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: const _Gate(),
    );
  }
}

/// يختار الشاشة حسب حالة الدخول — ومع أي 401 يرجع تلقائياً لشاشة الدخول.
class _Gate extends StatelessWidget {
  const _Gate();

  @override
  Widget build(BuildContext context) {
    final status = context.select<AuthController, AuthStatus>((a) => a.status);
    final Widget child = switch (status) {
      AuthStatus.checking => const _Splash(),
      AuthStatus.authenticated => const PosShell(),
      AuthStatus.unauthenticated || AuthStatus.authenticating => const LoginScreen(),
    };
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 280),
      child: KeyedSubtree(key: ValueKey(status == AuthStatus.authenticating ? AuthStatus.unauthenticated : status), child: child),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PosBackground(
        child: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Image.asset('assets/images/cobblers-official-mark.png', height: 96, color: Pos.fg),
            const SizedBox(height: 26),
            const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2)),
          ]),
        ),
      ),
    );
  }
}
