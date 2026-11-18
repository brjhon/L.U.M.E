import 'package:material_ui/material_ui.dart';

import '../models.dart';
import '../theme.dart';

/// Selo de atendimento. Regra do PDF (pág. 12): "Atende seu endereço" só quando a
/// cobertura foi declarada E verificada (CONFIRMED). Nada de selo por simples proximidade.
class EligibilityBadge extends StatelessWidget {
  const EligibilityBadge({super.key, required this.mode, required this.eligibility});

  final ServiceMode mode;
  final Eligibility? eligibility;

  static (String, IconData, Color) describe(ServiceMode mode, Eligibility? eligibility) {
    switch (mode) {
      case ServiceMode.inStore:
        return ('Ir até o local', Icons.storefront_outlined, const Color(0xFF1F6FB2));
      case ServiceMode.remote:
        return ('Atende remotamente', Icons.wifi, const Color(0xFF7A4BC2));
      case ServiceMode.delivery:
      case ServiceMode.atHome:
        switch (eligibility) {
          case Eligibility.confirmed:
            return (
              mode == ServiceMode.delivery ? 'Entrega no seu endereço' : 'Atende seu endereço',
              Icons.verified_outlined,
              LumeColors.success,
            );
          case Eligibility.notServed:
            return ('Não atende seu endereço', Icons.block, LumeColors.textMuted);
          case Eligibility.unconfirmed:
          case null:
            return ('Atendimento não confirmado', Icons.help_outline, LumeColors.warning);
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final (label, icon, color) = describe(mode, eligibility);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
