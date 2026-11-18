import 'package:material_ui/material_ui.dart';

import '../api_client.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/brand.dart';
import '../widgets/category_visuals.dart';
import '../widgets/listing_card.dart';
import 'address_screen.dart';
import 'listing_screen.dart';
import 'results_screen.dart';

/// Início (PDF, pág. 7): endereço, busca, categorias e destaques que atendem o endereço.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.api, required this.address, required this.openUrl});

  final ApiClient api;
  final ValueNotifier<SelectedAddress?> address;
  final UrlOpener openUrl;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<Category>> _categories = widget.api.categories();
  Future<SearchPage>? _highlights;
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    widget.address.addListener(_loadHighlights);
    _highlights = _fetchHighlights();
  }

  @override
  void dispose() {
    widget.address.removeListener(_loadHighlights);
    _search.dispose();
    super.dispose();
  }

  Future<SearchPage>? _fetchHighlights() {
    final a = widget.address.value;
    return a == null ? null : widget.api.search(address: a, pageSize: 3);
  }

  void _loadHighlights() => setState(() { _highlights = _fetchHighlights(); });

  Future<bool> _pickAddress() async {
    final picked = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => AddressScreen(api: widget.api, address: widget.address)),
    );
    return picked ?? false;
  }

  Future<void> _openResults({String? query, Category? category}) async {
    if (widget.address.value == null && !await _pickAddress()) return;
    if (!mounted) return;
    await Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => ResultsScreen(
        api: widget.api,
        address: widget.address,
        openUrl: widget.openUrl,
        query: query,
        category: category,
      ),
    ));
  }

  void _openListing(SearchItem item) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => ListingScreen(
        api: widget.api,
        listingId: item.listingId,
        address: widget.address.value,
        openUrl: widget.openUrl,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          setState(() { _categories = widget.api.categories(); });
          _loadHighlights();
        },
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            NavyHeader(
              child: Column(
                children: [
                  const SizedBox(height: 4),
                  const Center(child: LumeLogo()),
                  const SizedBox(height: 20),
                  Text(
                    'Comércios e serviços\nlocais perto de você',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineSmall?.copyWith(color: Colors.white, height: 1.2),
                  ),
                  const SizedBox(height: 10),
                  ValueListenableBuilder<SelectedAddress?>(
                    valueListenable: widget.address,
                    builder: (context, a, _) => AddressPill(label: a?.label, onTap: _pickAddress),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    key: const Key('search-field'),
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (q) {
                      if (q.trim().isNotEmpty) _openResults(query: q);
                    },
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search, color: LumeColors.textMuted),
                      hintText: 'Buscar comércios ou serviços...',
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.all(Radius.circular(14)),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const _SectionTitle('Categorias'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: FutureBuilder<List<Category>>(
                future: _categories,
                builder: (context, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator());
                  }
                  if (snap.hasError) {
                    return EmptyState(
                      icon: Icons.cloud_off,
                      title: 'Não foi possível carregar as categorias.',
                      action: ('Tentar de novo', () => setState(() { _categories = widget.api.categories(); })),
                    );
                  }
                  return GridView.count(
                    crossAxisCount: 4,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.9,
                    children: [
                      for (final c in snap.data!)
                        CategoryTile(slug: c.slug, label: c.name, onTap: () => _openResults(category: c)),
                    ],
                  );
                },
              ),
            ),
            _SectionTitle(
              'Destaques na sua região',
              action: widget.address.value == null ? null : ('Ver todos', () => _openResults()),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              child: _buildHighlights(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHighlights() {
    final future = _highlights;
    if (future == null) {
      return Card(
        child: EmptyState(
          icon: Icons.location_on_outlined,
          title: 'Onde você está?',
          message: 'Informe seu endereço para ver quem entrega ou atende aí.',
          action: ('Informar endereço', _pickAddress),
        ),
      );
    }
    return FutureBuilder<SearchPage>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
        }
        final items = snap.data?.items ?? const <SearchItem>[];
        if (snap.hasError || items.isEmpty) {
          return Card(
            child: EmptyState(
              icon: Icons.search_off,
              title: snap.hasError ? 'Sem conexão com o servidor.' : 'Ainda não há fornecedores aqui.',
              action: ('Tentar de novo', _loadHighlights),
            ),
          );
        }
        return Column(
          children: [
            for (final item in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: ListingCard(item: item, onTap: () => _openListing(item)),
              ),
          ],
        );
      },
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text, {this.action});
  final String text;
  final (String, VoidCallback)? action;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 22, 12, 10),
        child: Row(
          children: [
            Expanded(child: Text(text, style: Theme.of(context).textTheme.titleMedium)),
            if (action != null)
              TextButton(
                onPressed: action!.$2,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [Text(action!.$1), const Icon(Icons.chevron_right, size: 18)],
                ),
              ),
          ],
        ),
      );
}
