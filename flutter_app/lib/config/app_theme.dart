import 'package:flutter/material.dart';
import 'config/app_theme.dart';
import 'screens/auth/login_screen.dart';

class SkilloraApp extends StatelessWidget {
  const SkilloraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Skillora',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const LoginScreen(),
    );
  }
}
