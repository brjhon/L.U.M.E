import 'package:material_ui/material_ui.dart';

import '../theme.dart';

/// Ícone por slug de categoria (raízes e subcategorias semeadas no banco).
const _bySlug = <String, IconData>{
  'alimentacao': Icons.restaurant,
  'mercado': Icons.shopping_basket,
  'farmacia': Icons.local_pharmacy,
  'pets': Icons.pets,
  'passeador-de-caes': Icons.pets,
  'cuidados': Icons.volunteer_activism,
  'cuidador-de-idosos': Icons.elderly,
  'diarista': Icons.cleaning_services,
  'tecnologia': Icons.computer,
  'tecnico-informatica': Icons.computer,
  'casa': Icons.home_repair_service,
  'servicos-gerais': Icons.build,
  'eletricista': Icons.bolt,
  'encanador': Icons.plumbing,
};

IconData categoryIcon(String? slug) => _bySlug[slug] ?? Icons.storefront;

/// Quadrado com ícone, usado como "foto" do fornecedor enquanto não há mídia própria.
class CategoryThumb extends StatelessWidget {
  const CategoryThumb({super.key, required this.slug, this.size = 56});

  final String slug;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [LumeColors.navyLight, LumeColors.navy],
        ),
        borderRadius: BorderRadius.circular(size * 0.25),
      ),
      child: Icon(categoryIcon(slug), color: LumeColors.orange, size: size * 0.5),
    );
  }
}

/// Bloco de categoria da tela inicial (ícone laranja + nome).
class CategoryTile extends StatelessWidget {
  const CategoryTile({super.key, required this.slug, required this.label, required this.onTap});

  final String slug;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: LumeColors.border),
          ),
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: LumeColors.orangeSoft, borderRadius: BorderRadius.circular(12)),
                child: Icon(categoryIcon(slug), color: LumeColors.orange, size: 24),
              ),
              const SizedBox(height: 8),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  maxLines: 1,
                  textScaler: TextScaler.noScaling,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: LumeColors.text),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
