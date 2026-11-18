import 'package:material_ui/material_ui.dart';

import '../api_client.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/brand.dart';
import '../widgets/category_visuals.dart';
import '../widgets/eligibility_badge.dart';
import 'results_screen.dart' show UrlOpener;

/// Perfil da oferta com contatos (PDF, pág. 7).
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
      body: FutureBuilder<ListingDetail>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Column(children: [_TopBar(), Expanded(child: Center(child: CircularProgressIndicator()))]);
          }
          if (snap.hasError) {
            final err = snap.error;
            return Column(
              children: [
                const _TopBar(),
                Expanded(
                  child: EmptyState(
                    icon: Icons.storefront_outlined,
                    title: err is ApiException && err.statusCode == 404
                        ? 'Esta oferta não está mais disponível.'
                        : 'Não foi possível carregar.',
                    action: ('Tentar de novo', () => setState(() { _future = _load(); })),
                  ),
                ),
              ],
            );
          }
          return _Detail(detail: snap.data!, onContact: _contact);
        },
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar();

  @override
  Widget build(BuildContext context) => NavyHeader(
        padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Voltar',
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
          ],
        ),
      );
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
      padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
      children: [
        NavyHeader(
          padding: const EdgeInsets.fromLTRB(4, 0, 20, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconButton(
                tooltip: 'Voltar',
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () => Navigator.of(context).maybePop(),
              ),
              Padding(
                padding: const EdgeInsets.only(left: 16, top: 4),
                child: Row(
                  children: [
                    CategoryThumb(slug: d.categorySlug, size: 72),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            d.providerName,
                            style: theme.textTheme.titleLarge?.copyWith(color: Colors.white, height: 1.15),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            d.title,
                            style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white70),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              EligibilityBadge(mode: d.mode, eligibility: d.eligibility),
              _Fact(icon: categoryIcon(d.categorySlug), text: d.categoryName),
              if (d.distanceM != null) _Fact(icon: Icons.location_on_outlined, text: formatDistance(d.distanceM!)),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Row(
            children: [
              if (phone != null)
                _ContactButton(
                  key: const Key('btn-phone'),
                  icon: Icons.call,
                  label: 'Ligar',
                  onTap: () => onContact(d, 'PHONE', Uri(scheme: 'tel', path: phone)),
                ),
              if (whatsapp != null)
                _ContactButton(
                  key: const Key('btn-whatsapp'),
                  icon: Icons.chat,
                  label: 'WhatsApp',
                  highlighted: true,
                  onTap: () => onContact(d, 'WHATSAPP', Uri.parse('https://wa.me/$whatsapp')),
                ),
              if (place != null)
                _ContactButton(
                  key: const Key('btn-directions'),
                  icon: Icons.directions,
                  label: 'Como chegar',
                  onTap: () => onContact(
                    d,
                    'DIRECTIONS',
                    Uri.https('www.google.com', '/maps/dir/', {
                      'api': '1',
                      'destination': '${place.location.lat},${place.location.lng}',
                    }),
                  ),
                ),
            ],
          ),
        ),
        _Section(
          title: 'Sobre',
          children: [
            if (d.description != null) Text(d.description!, style: theme.textTheme.bodyLarge),
            if (d.providerDescription != null) ...[
              const SizedBox(height: 8),
              Text(d.providerDescription!, style: theme.textTheme.bodyMedium?.copyWith(color: LumeColors.textMuted)),
            ],
            const SizedBox(height: 12),
            _InfoRow(icon: Icons.handshake_outlined, text: _modeExplanation(d)),
          ],
        ),
        if (place != null)
          _Section(
            title: 'Endereço',
            children: [_InfoRow(icon: Icons.storefront_outlined, text: place.address)],
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Text(
            'Informações declaradas pelo fornecedor. Horários não indicam disponibilidade em tempo real '
            'e o L.U.M.E. não garante a qualidade do serviço.',
            style: theme.textTheme.bodySmall,
          ),
        ),
      ],
    );
  }

  static String _modeExplanation(ListingDetail d) {
    switch (d.mode) {
      case ServiceMode.inStore:
        return 'Atendimento no local: é preciso ir até o estabelecimento.';
      case ServiceMode.remote:
        return 'Atendimento remoto, sem visita.';
      case ServiceMode.delivery:
      case ServiceMode.atHome:
        final what = d.mode == ServiceMode.delivery ? 'Entrega' : 'Atendimento em domicílio';
        switch (d.eligibility) {
          case Eligibility.confirmed:
            return '$what confirmada para o seu endereço.';
          case Eligibility.notServed:
            return '$what não cobre o seu endereço, segundo o fornecedor.';
          case Eligibility.unconfirmed:
          case null:
            return '$what ainda não confirmada para o seu endereço. Pergunte ao fornecedor.';
        }
    }
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: LumeColors.textMuted),
          const SizedBox(width: 3),
          Text(text, style: Theme.of(context).textTheme.bodySmall),
        ],
      );
}

class _ContactButton extends StatelessWidget {
  const _ContactButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.highlighted = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final fg = highlighted ? Colors.white : LumeColors.navy;
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Material(
          color: highlighted ? LumeColors.orange : Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              height: 76,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: highlighted ? null : Border.all(color: LumeColors.border),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, color: highlighted ? Colors.white : LumeColors.orange, size: 26),
                  const SizedBox(height: 6),
                  Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 13)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 10),
                ...children,
              ],
            ),
          ),
        ),
      );
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: LumeColors.orange),
          const SizedBox(width: 10),
          Expanded(child: Text(text)),
        ],
      );
}
