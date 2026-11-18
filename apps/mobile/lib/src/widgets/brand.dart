import 'package:material_ui/material_ui.dart';

import '../theme.dart';

/// Logo "📍 L.U.M.E." com os pontos em laranja.
class LumeLogo extends StatelessWidget {
  const LumeLogo({super.key, this.size = 22, this.color = Colors.white});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final letter = TextStyle(fontSize: size, fontWeight: FontWeight.w900, color: color, letterSpacing: 0.5);
    final dot = letter.copyWith(color: LumeColors.orange);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.location_on, color: LumeColors.orange, size: size * 1.15),
        const SizedBox(width: 4),
        Text.rich(
          TextSpan(children: [
            for (final l in ['L', 'U', 'M', 'E']) ...[
              TextSpan(text: l, style: letter),
              TextSpan(text: '.', style: dot),
            ],
          ]),
          semanticsLabel: 'LUME',
        ),
      ],
    );
  }
}

/// Faixa azul-marinho com cantos arredondados embaixo, usada no topo das telas.
class NavyHeader extends StatelessWidget {
  const NavyHeader({super.key, required this.child, this.padding = const EdgeInsets.fromLTRB(20, 8, 20, 24)});

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [LumeColors.navy, LumeColors.navyLight],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: SafeArea(bottom: false, child: Padding(padding: padding, child: child)),
    );
  }
}

/// "📍 Condomínio X ⌄": endereço atual em destaque laranja, toque para trocar.
class AddressPill extends StatelessWidget {
  const AddressPill({super.key, required this.label, required this.onTap});

  final String? label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      key: const Key('address-bar'),
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.location_on, size: 18, color: LumeColors.orange),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label ?? 'Informe seu endereço',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: LumeColors.orange, fontWeight: FontWeight.w700, fontSize: 14),
              ),
            ),
            const Icon(Icons.keyboard_arrow_down, size: 20, color: LumeColors.orange),
          ],
        ),
      ),
    );
  }
}

/// Estado vazio padrão: ícone em círculo, texto e ação opcional.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.action});

  final IconData icon;
  final String title;
  final String? message;
  final (String, VoidCallback)? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(color: LumeColors.orangeSoft, shape: BoxShape.circle),
            child: Icon(icon, size: 34, color: LumeColors.orange),
          ),
          const SizedBox(height: 16),
          Text(title, textAlign: TextAlign.center, style: theme.textTheme.titleMedium),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium?.copyWith(color: LumeColors.textMuted)),
          ],
          if (action != null) ...[
            const SizedBox(height: 16),
            OutlinedButton(onPressed: action!.$2, child: Text(action!.$1)),
          ],
        ],
      ),
    );
  }
}
