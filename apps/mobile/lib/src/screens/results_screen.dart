import 'package:material_ui/material_ui.dart';

import '../api_client.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/brand.dart';
import '../widgets/listing_card.dart';
import 'address_screen.dart';
import 'listing_screen.dart';

typedef UrlOpener = Future<bool> Function(Uri uri);

/// Resultados (PDF, pág. 7): busca editável, filtros por tipo de atendimento e cards com selo.
/// Também é a aba "Buscar" (`embedded: true`), sem botão de voltar.
class ResultsScreen extends StatefulWidget {
  const ResultsScreen({
    super.key,
    required this.api,
    required this.address,
    required this.openUrl,
    this.query,
    this.category,
    this.embedded = false,
  });

  final ApiClient api;
  final ValueNotifier<SelectedAddress?> address;
  final UrlOpener openUrl;
  final String? query;
  final Category? category;
  final bool embedded;

  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  late final _search = TextEditingController(text: widget.query ?? '');
  late Category? _category = widget.category;
  final List<SearchItem> _items = [];
  ServiceMode? _mode;
  bool _includeNotServed = false;
  bool _hasMore = false;
  bool _loading = false;
  String? _error;
  int _page = 0;
  int _generation = 0; // descarta respostas de buscas anteriores

  @override
  void initState() {
    super.initState();
    widget.address.addListener(_reload);
    _reload();
  }

  @override
  void dispose() {
    widget.address.removeListener(_reload);
    _search.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    _generation++;
    _items.clear();
    _page = 0;
    _hasMore = false;
    await _loadMore();
  }

  Future<void> _loadMore() async {
    final address = widget.address.value;
    if (address == null) {
      setState(() {});
      return;
    }
    final gen = _generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await widget.api.search(
        address: address,
        q: _search.text,
        category: _category?.slug,
        mode: _mode,
        includeNotServed: _includeNotServed,
        page: _page + 1,
      );
      if (!mounted || gen != _generation) return;
      setState(() {
        _page += 1;
        _items.addAll(page.items);
        _hasMore = page.hasMore;
      });
    } on ApiException catch (e) {
      if (mounted && gen == _generation) setState(() => _error = e.message);
    } catch (_) {
      if (mounted && gen == _generation) setState(() => _error = 'Sem conexão com o servidor.');
    } finally {
      if (mounted && gen == _generation) setState(() => _loading = false);
    }
  }

  void _setMode(ServiceMode? mode) {
    setState(() => _mode = mode);
    _reload();
  }

  void _showNotServed() {
    setState(() => _includeNotServed = true);
    _reload();
  }

  Future<void> _pickAddress() => Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => AddressScreen(api: widget.api, address: widget.address)),
      );

  void _openListing(SearchItem item) => Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => ListingScreen(
          api: widget.api,
          listingId: item.listingId,
          address: widget.address.value,
          openUrl: widget.openUrl,
        ),
      ));

  @override
  Widget build(BuildContext context) {
    final address = widget.address.value;
    return Scaffold(
      body: Column(
        children: [
          _header(context, address),
          Expanded(
            child: address == null
                ? EmptyState(
                    icon: Icons.location_on_outlined,
                    title: 'Onde você está?',
                    message: 'Informe seu endereço para ver quem atende você.',
                    action: ('Informar endereço', _pickAddress),
                  )
                : RefreshIndicator(onRefresh: _reload, child: _list(context)),
          ),
        ],
      ),
    );
  }

  Widget _header(BuildContext context, SelectedAddress? address) {
    final canPop = !widget.embedded && Navigator.of(context).canPop();
    return NavyHeader(
      padding: const EdgeInsets.fromLTRB(8, 4, 16, 16),
      child: Column(
        children: [
          SizedBox(
            height: 48,
            child: Row(
              children: [
                if (canPop)
                  IconButton(
                    tooltip: 'Voltar',
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => Navigator.of(context).pop(),
                  )
                else
                  const SizedBox(width: 48),
                const Expanded(
                  child: Text(
                    'Resultados',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 48),
              ],
            ),
          ),
          AddressPill(label: address?.label, onTap: _pickAddress),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: TextField(
              key: const Key('results-search-field'),
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _reload(),
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search, color: LumeColors.textMuted),
                hintText: 'Buscar comércios ou serviços...',
                enabledBorder: const OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(14)),
                  borderSide: BorderSide.none,
                ),
                suffixIcon: ListenableBuilder(
                  listenable: _search,
                  builder: (context, _) => _search.text.isEmpty
                      ? const SizedBox.shrink()
                      : IconButton(
                          tooltip: 'Limpar',
                          icon: const Icon(Icons.close, color: LumeColors.textMuted),
                          onPressed: () {
                            _search.clear();
                            _reload();
                          },
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _list(BuildContext context) {
    final theme = Theme.of(context);
    final children = <Widget>[
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
        child: Row(
          children: [
            if (_category != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: InputChip(
                  label: Text(_category!.name),
                  selected: true,
                  showCheckmark: false,
                  onDeleted: () {
                    setState(() => _category = null);
                    _reload();
                  },
                  deleteIconColor: Colors.white,
                ),
              ),
            _modeChip(null, 'Todos'),
            for (final m in ServiceMode.values) _modeChip(m, m.label),
          ],
        ),
      ),
    ];

    if (_items.isNotEmpty) {
      children.add(Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
        child: Text(
          _search.text.trim().isEmpty
              ? 'Quem atende perto de você'
              : 'Resultados para "${_search.text.trim()}"',
          style: theme.textTheme.titleSmall,
        ),
      ));
    }

    var notServedHeaderShown = false;
    for (final item in _items) {
      if (item.eligibility == Eligibility.notServed && !notServedHeaderShown) {
        notServedHeaderShown = true;
        children.add(Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
          child: Text('Não atendem seu endereço', style: theme.textTheme.titleSmall),
        ));
      }
      children.add(Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
        child: ListingCard(item: item, onTap: () => _openListing(item)),
      ));
    }

    if (_loading) {
      children.add(const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())));
    } else if (_error != null) {
      children.add(EmptyState(icon: Icons.cloud_off, title: _error!, action: ('Tentar de novo', _reload)));
    } else if (_items.isEmpty) {
      children.add(EmptyState(
        icon: Icons.search_off,
        title: 'Ninguém confirmou atendimento neste endereço ainda.',
        message: 'Tente outra palavra ou categoria.',
        action: _includeNotServed ? null : ('Ver também quem não atende', _showNotServed),
      ));
    } else if (_hasMore) {
      children.add(Padding(
        padding: const EdgeInsets.all(16),
        child: OutlinedButton(onPressed: _loadMore, child: const Text('Carregar mais')),
      ));
    } else if (!_includeNotServed) {
      children.add(Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Center(
          child: TextButton(
            onPressed: _showNotServed,
            child: const Text('Mostrar também quem não atende este endereço'),
          ),
        ),
      ));
    }

    return ListView(padding: const EdgeInsets.only(bottom: 24), children: children);
  }

  Widget _modeChip(ServiceMode? mode, String label) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: ChoiceChip(
          label: Text(label),
          selected: _mode == mode,
          showCheckmark: false,
          onSelected: (_) => _setMode(mode),
        ),
      );
}
