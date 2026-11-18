import 'package:material_ui/material_ui.dart';

import '../api_client.dart';
import '../models.dart';
import '../widgets/eligibility_badge.dart';
import 'results_screen.dart' show UrlOpener;

/// Perfil da oferta com botões de contato (PDF, pág. 7).
class ListingScreen extends StatefulWidget {
  const ListingScreen({
    super.key,
    required this.api,
    required this.listingId,
    required this.address,
    required this.openUrl,
  });

  final ApiClient api;
  final String listingId;
  final SelectedAddress? address;
  final UrlOpener openUrl;

  @override
  State<ListingScreen> createState() => _ListingScreenState();
}

class _ListingScreenState extends State<ListingScreen> {
  late Future<ListingDetail> _future = _load();

  Future<ListingDetail> _load() => widget.api.listing(widget.listingId, address: widget.address);

  Future<void> _contact(ListingDetail d, String channel, Uri uri) async {
    widget.api.contactEvent(d.id, channel, communityId: widget.address?.communityId);
    final ok = await widget.openUrl(uri);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível abrir o aplicativo.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: FutureBuilder<ListingDetail>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            final err = snap.error;
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(err is ApiException && err.statusCode == 404
                      ? 'Esta oferta não está mais disponível.'
                      : 'Não foi possível carregar.'),
                  TextButton(
                    onPressed: () => setState(() => _future = _load()),
                    child: const Text('Tentar de novo'),
                  ),
                ],
              ),
            );
          }
          return _Detail(detail: snap.data!, onContact: _contact);
        },
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.detail, required this.onContact});
  final ListingDetail detail;
  final Future<void> Function(ListingDetail, String, Uri) onContact;

  @override
  Widget build(BuildContext context) {
    final d = detail;
    final theme = Theme.of(context);
    final whatsapp = d.whatsapp;
    final phone = d.phone;
    final place = d.locations.isEmpty ? null : d.locations.first;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(d.providerName, style: theme.textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text(d.title, style: theme.textTheme.titleMedium),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            EligibilityBadge(mode: d.mode, eligibility: d.eligibility),
            Text('${d.categoryName} · ${d.mode.label}', style: theme.textTheme.bodySmall),
            if (d.distanceM != null) Text('· ${formatDistance(d.distanceM!)}', style: theme.textTheme.bodySmall),
          ],
        ),
        if (d.description != null) ...[const SizedBox(height: 16), Text(d.description!)],
        if (d.providerDescription != null) ...[
          const SizedBox(height: 8),
          Text(d.providerDescription!, style: theme.textTheme.bodySmall),
        ],
        if (place != null) ...[
          const SizedBox(height: 16),
          Row(children: [
            const Icon(Icons.place_outlined, size: 18),
            const SizedBox(width: 6),
            Expanded(child: Text(place.address)),
          ]),
        ],
        const SizedBox(height: 24),
        if (whatsapp != null)
          FilledButton.icon(
            key: const Key('btn-whatsapp'),
            onPressed: () => onContact(d, 'WHATSAPP', Uri.parse('https://wa.me/$whatsapp')),
            icon: const Icon(Icons.chat_outlined),
            label: const Text('Chamar no WhatsApp'),
          ),
        if (phone != null) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            key: const Key('btn-phone'),
            onPressed: () => onContact(d, 'PHONE', Uri(scheme: 'tel', path: phone)),
            icon: const Icon(Icons.call_outlined),
            label: const Text('Ligar'),
          ),
        ],
        if (place != null) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            key: const Key('btn-directions'),
            onPressed: () => onContact(
              d,
              'DIRECTIONS',
              Uri.https('www.google.com', '/maps/dir/', {
                'api': '1',
                'destination': '${place.location.lat},${place.location.lng}',
              }),
            ),
            icon: const Icon(Icons.directions_outlined),
            label: const Text('Como chegar'),
          ),
        ],
        const SizedBox(height: 24),
        Text(
          'Informações declaradas pelo fornecedor. Horários não indicam disponibilidade em tempo real '
          'e o L.U.M.E. não garante a qualidade do serviço.',
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}
