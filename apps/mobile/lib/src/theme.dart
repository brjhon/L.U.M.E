import 'package:material_ui/material_ui.dart';

/// Identidade visual (PDF, págs. 1 e 7): azul-marinho, laranja e superfícies claras.
class LumeColors {
  static const navy = Color(0xFF0B2236);
  static const navyLight = Color(0xFF15344F);
  static const orange = Color(0xFFF58220);
  static const orangeSoft = Color(0xFFFFF1E5);
  static const background = Color(0xFFF3F5F8);
  static const surface = Colors.white;
  static const text = Color(0xFF14212E);
  static const textMuted = Color(0xFF66768A);
  static const border = Color(0xFFE2E7EE);
  static const success = Color(0xFF1E9E5A);
  static const warning = Color(0xFFC77700);
}

ThemeData buildLumeTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: LumeColors.orange,
    primary: LumeColors.orange,
    onPrimary: Colors.white,
    secondary: LumeColors.navy,
    surface: LumeColors.surface,
    onSurface: LumeColors.text,
    brightness: Brightness.light,
  );
  final base = ThemeData(colorScheme: scheme, useMaterial3: true);
  final text = base.textTheme.apply(bodyColor: LumeColors.text, displayColor: LumeColors.text);

  return base.copyWith(
    scaffoldBackgroundColor: LumeColors.background,
    textTheme: text.copyWith(
      headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.3),
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w800),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
      titleSmall: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      bodySmall: text.bodySmall?.copyWith(color: LumeColors.textMuted),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: LumeColors.navy,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white),
    ),
    cardTheme: CardThemeData(
      color: LumeColors.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: LumeColors.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      hintStyle: const TextStyle(color: LumeColors.textMuted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: LumeColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: LumeColors.orange, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: LumeColors.orange,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: LumeColors.navy,
        side: const BorderSide(color: LumeColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: Colors.white,
      selectedColor: LumeColors.orange,
      side: const BorderSide(color: LumeColors.border),
      labelStyle: const TextStyle(fontWeight: FontWeight.w600, color: LumeColors.text),
      secondaryLabelStyle: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white),
      checkmarkColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: LumeColors.orangeSoft,
      elevation: 0,
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: states.contains(WidgetState.selected) ? LumeColors.orange : LumeColors.textMuted,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected) ? LumeColors.orange : LumeColors.textMuted,
        ),
      ),
    ),
    dividerTheme: const DividerThemeData(color: LumeColors.border, space: 1),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
