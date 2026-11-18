import 'package:material_ui/material_ui.dart';

/// Cores da identidade visual (azul-marinho + laranja).
class LumeColors {
  static const navy = Color(0xFF0B2236);
  static const orange = Color(0xFFF58220);
}

ThemeData buildLumeTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: LumeColors.orange,
    primary: LumeColors.orange,
    surface: LumeColors.navy,
    brightness: Brightness.dark,
  );
  return ThemeData(colorScheme: scheme, useMaterial3: true);
}
