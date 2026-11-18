import 'package:material_ui/material_ui.dart';

import '../models.dart';

/// Selo de atendimento. Regra do PDF (pág. 12): "Atende seu endereço" só quando a
/// cobertura foi declarada E verificada (CONFIRMED). Nada de selo por simples proximidade.
class EligibilityBadge extends StatelessWidget {
  const EligibilityBadge({super.key, required this.mode, required this.eligibility});

  final ServiceMode mode;
  final Eligibility? eligibility;

  static (String, IconData, Color) describe(ServiceMode mode, Eligibility? eligibility) {
    switch (mode) {
      case ServiceMode.inStore:
        return ('Ir até o local', Icons.storefront_outlined, Colors.lightBlue.shade300);
      case ServiceMode.remote:
        return ('Atende remotamente', Icons.wifi, Colors.purple.shade200);
      case ServiceMode.delivery:
      case ServiceMode.atHome:
        switch (eligibility) {
          case Eligibility.confirmed:
            return (
              mode == ServiceMode.delivery ? 'Entrega no seu endereço' : 'Atende seu endereço',
              Icons.verified_outlined,
              Colors.green.shade400,
            );
          case Eligibility.notServed:
            return ('Não atende seu endereço', Icons.block, Colors.grey.shade500);
          case Eligibility.unconfirmed:
          case null:
            return ('Atendimento não confirmado', Icons.help_outline, Colors.amber.shade400);
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final (label, icon, color) = describe(mode, eligibility);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.6)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
