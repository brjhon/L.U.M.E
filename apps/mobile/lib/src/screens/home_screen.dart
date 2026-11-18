import 'package:material_ui/material_ui.dart';

import '../api_client.dart';
import '../models.dart';
import 'address_screen.dart';
import 'results_screen.dart';

const _categoryIcons = <String, IconData>{
  'restaurant': Icons.restaurant_outlined,
  'shopping_cart': Icons.shopping_cart_outlined,
  'local_pharmacy': Icons.local_pharmacy_outlined,
  'pets': Icons.pets_outlined,
  'favorite': Icons.favorite_outline,
  'computer': Icons.computer_outlined,
  'home': Icons.home_outlined,
  'build': Icons.build_outlined,
};

/// Início: endereço → busca por palavra ou categoria (jornada do PDF, pág. 5).
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
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<bool> _pickAddress() async {
    final picked = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => AddressScreen(api: widget.api, address: widget.address)),
    );
    return picked ?? false;
  }

  Future<void> _openResults({String? query, Category? category}) async {
    if (widget.address.value == null && !await _pickAddress()) return;
    final address = widget.address.value;
    if (address == null || !mounted) return;
    await Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => ResultsScreen(
        api: widget.api,
        address: address,
        openUrl: widget.openUrl,
        query: query,
        category: category,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('L.U.M.E.')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ValueListenableBuilder<SelectedAddress?>(
            valueListenable: widget.address,
            builder: (context, address, _) => Card(
              child: ListTile(
                key: const Key('address-bar'),
                leading: const Icon(Icons.place_outlined),
                title: Text(address?.label ?? 'Informe seu endereço'),
                subtitle: Text(address == null ? 'Para ver quem atende você' : 'Toque para trocar'),
                trailing: const Icon(Icons.chevron_right),
                onTap: _pickAddress,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('O que você precisa?', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 12),
          TextField(
            key: const Key('search-field'),
            controller: _search,
            textInputAction: TextInputAction.search,
            onSubmitted: (q) {
              if (q.trim().isNotEmpty) _openResults(query: q);
            },
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Buscar comércios ou serviços...',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 20),
          Text('Categorias', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          FutureBuilder<List<Category>>(
            future: _categories,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator());
              }
              if (snap.hasError) {
                return Row(
                  children: [
                    const Expanded(child: Text('Não foi possível carregar as categorias.')),
                    TextButton(
                      onPressed: () => setState(() => _categories = widget.api.categories()),
                      child: const Text('Tentar de novo'),
                    ),
                  ],
                );
              }
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final c in snap.data!)
                    ActionChip(
                      avatar: Icon(_categoryIcons[c.icon] ?? Icons.category_outlined, size: 18),
                      label: Text(c.name),
                      onPressed: () => _openResults(category: c),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
