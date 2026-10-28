import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'core/api_client.dart';
import 'core/session_storage.dart';
import 'screens/home_shell.dart';
import 'screens/login_screen.dart';
import 'state/accounting_controller.dart';
import 'state/auth_controller.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ar');
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: AC.s1,
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  final storage = SessionStorage();
  final api = ApiClient(storage);
  final auth = AuthController(api, storage);
  // لا ننتظر — شاشة البدء تظهر فوراً أثناء التحقق من الجلسة
  auth.restore();

  runApp(MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: auth),
      ChangeNotifierProvider(create: (_) => AccountingController(api)),
    ],
    child: const CobblerAccountingApp(),
  ));
}

class CobblerAccountingApp extends StatelessWidget {
  const CobblerAccountingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'المركز المحاسبي — إبرة وخيط الإسكافي',
      debugShowCheckedModeBanner: false,
      theme: AC.theme(),
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
      AuthStatus.authenticated => const HomeShell(),
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
      body: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Image.asset('assets/images/cobblers-official-mark-white.png', height: 96),
          const SizedBox(height: 26),
          const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2)),
        ]),
      ),
    );
  }
}
