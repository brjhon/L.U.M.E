import 'package:material_ui/material_ui.dart';

import '../api_client.dart';
import '../models.dart';
import '../widgets/eligibility_badge.dart';
import 'listing_screen.dart';

typedef UrlOpener = Future<bool> Function(Uri uri);

class ResultsScreen extends StatefulWidget {
  const ResultsScreen({
    super.key,
    required this.api,
    required this.address,
    required this.openUrl,
    this.query,
    this.category,
  });

  final ApiClient api;
  final SelectedAddress address;
  final UrlOpener openUrl;
  final String? query;
  final Category? category;

  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  final List<SearchItem> _items = [];
  ServiceMode? _mode;
  bool _includeNotServed = false;
  bool _hasMore = false;
  bool _loading = false;
  String? _error;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    _items.clear();
    _page = 0;
    _hasMore = false;
    await _loadMore();
  }

  Future<void> _loadMore() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await widget.api.search(
        address: widget.address,
        q: widget.query,
        category: widget.category?.slug,
        mode: _mode,
        includeNotServed: _includeNotServed,
        page: _page + 1,
      );
      if (!mounted) return;
      setState(() {
        _page += 1;
        _items.addAll(page.items);
        _hasMore = page.hasMore;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Sem conexão com o servidor.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _setMode(ServiceMode? mode) {
    setState(() => _mode = mode);
    _reload();
  }

  String get _title {
    if (widget.query != null && widget.query!.trim().isNotEmpty) return '"${widget.query!.trim()}"';
    return widget.category?.name ?? 'Resultados';
  }

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[
      _AddressHeader(address: widget.address),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(
          children: [
            _modeChip(null, 'Todos'),
            for (final m in ServiceMode.values) _modeChip(m, m.label),
          ],
        ),
      ),
    ];

    var notServedHeaderShown = false;
    for (final item in _items) {
      if (item.eligibility == Eligibility.notServed && !notServedHeaderShown) {
        notServedHeaderShown = true;
        children.add(const _SectionHeader('Não atendem seu endereço'));
      }
      children.add(_ResultTile(
        item: item,
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
          builder: (_) => ListingScreen(
            api: widget.api,
            listingId: item.listingId,
            address: widget.address,
            openUrl: widget.openUrl,
          ),
        )),
      ));
    }

    if (_loading) {
      children.add(const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())));
    } else if (_error != null) {
      children.add(_Message(icon: Icons.cloud_off, text: _error!, action: ('Tentar de novo', _reload)));
    } else if (_items.isEmpty) {
      children.add(_Message(
        icon: Icons.search_off,
        text: 'Ninguém confirmou atendimento neste endereço ainda.',
        action: _includeNotServed
            ? null
            : ('Ver também quem não atende', () {
                setState(() => _includeNotServed = true);
                _reload();
              }),
      ));
    } else if (_hasMore) {
      children.add(Padding(
        padding: const EdgeInsets.all(16),
        child: OutlinedButton(onPressed: _loadMore, child: const Text('Carregar mais')),
      ));
    } else if (!_includeNotServed) {
      children.add(Center(
        child: TextButton(
          onPressed: () {
            setState(() => _includeNotServed = true);
            _reload();
          },
          child: const Text('Mostrar também quem não atende este endereço'),
        ),
      ));
    }

    return Scaffold(
      appBar: AppBar(title: Text(_title)),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: ListView(padding: const EdgeInsets.only(bottom: 24), children: children),
      ),
    );
  }

  Widget _modeChip(ServiceMode? mode, String label) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        child: ChoiceChip(
          label: Text(label),
          selected: _mode == mode,
          onSelected: (_) => _setMode(mode),
        ),
      );
}

class _AddressHeader extends StatelessWidget {
  const _AddressHeader({required this.address});
  final SelectedAddress address;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Row(
          children: [
            const Icon(Icons.place_outlined, size: 16),
            const SizedBox(width: 6),
            Expanded(
              child: Text(address.label, maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      );
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
        child: Text(text, style: Theme.of(context).textTheme.titleSmall),
      );
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({required this.item, required this.onTap});
  final SearchItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = item.eligibility == Eligibility.notServed;
    return Opacity(
      opacity: muted ? 0.6 : 1,
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.providerName, style: theme.textTheme.titleMedium),
                const SizedBox(height: 2),
                Text(item.title, style: theme.textTheme.bodyMedium),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    EligibilityBadge(mode: item.mode, eligibility: item.eligibility),
                    Text(item.categoryName, style: theme.textTheme.bodySmall),
                    if (item.distanceM != null)
                      Text('· ${formatDistance(item.distanceM!)}', style: theme.textTheme.bodySmall),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.text, this.action});
  final IconData icon;
  final String text;
  final (String, VoidCallback)? action;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            Icon(icon, size: 40),
            const SizedBox(height: 12),
            Text(text, textAlign: TextAlign.center),
            if (action != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: action!.$2, child: Text(action!.$1)),
            ],
          ],
        ),
      );
}
