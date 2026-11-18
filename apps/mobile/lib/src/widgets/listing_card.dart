import 'package:material_ui/material_ui.dart';

import '../models.dart';
import '../theme.dart';
import 'category_visuals.dart';
import 'eligibility_badge.dart';

/// Card de resultado (PDF, pág. 7): miniatura, nome, oferta, categoria, distância e selo.
/// Sem notas/avaliações: só entram quando houver avaliações verificadas (Sprint 4).
class ListingCard extends StatelessWidget {
  const ListingCard({super.key, required this.item, required this.onTap});

  final SearchItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = item.eligibility == Eligibility.notServed;
    return Opacity(
      opacity: muted ? 0.55 : 1,
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CategoryThumb(slug: item.categorySlug, size: 64),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.providerName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(color: LumeColors.textMuted),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              item.categoryName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodySmall,
                            ),
                          ),
                          if (item.distanceM != null) ...[
                            const SizedBox(width: 8),
                            const Icon(Icons.location_on_outlined, size: 14, color: LumeColors.textMuted),
                            Text(formatDistance(item.distanceM!), style: theme.textTheme.bodySmall),
                          ],
                        ],
                      ),
                      const SizedBox(height: 8),
                      EligibilityBadge(mode: item.mode, eligibility: item.eligibility),
                    ],
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.only(top: 20),
                  child: Icon(Icons.chevron_right, color: LumeColors.textMuted),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
