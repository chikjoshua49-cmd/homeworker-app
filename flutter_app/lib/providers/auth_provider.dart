import 'package:flutter/material.dart';

class AppTheme {
  static const Color primary = Color(0xFF1E88E5);
  static const Color accent = Color(0xFF00BFA5);
  static const Color background = Color(0xFFF5F7FA);
  static const Color text = Color(0xFF1C1C1E);

  static ThemeData get lightTheme {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: background,
      appBarTheme: const AppBarTheme(
        centerTitle: true,
        backgroundColor: primary,
        foregroundColor: Colors.white,
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(color: text),
        bodyLarge: TextStyle(color: text),
        bodyMedium: TextStyle(color: text),
      ),
    );
  }
}
