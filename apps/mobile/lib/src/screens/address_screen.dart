import 'package:material_ui/material_ui.dart';

import '../api_client.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/brand.dart';

/// Endereço do condomínio de demonstração (pnpm db:seed:demo).
const demoAddress = SelectedAddress(
  label: 'Condomínio Jardim das Acácias (demo)',
  location: GeoPoint(-23.5893, -46.6346),
  communityId: '00000000-0000-4000-8000-000000000900',
);

const _showDemo = bool.fromEnvironment('SHOW_DEMO_ADDRESS', defaultValue: true);

/// Seleção de endereço por texto ou CEP: a busca não exige GPS (LGPD, PDF pág. 9).
class AddressScreen extends StatefulWidget {
  const AddressScreen({super.key, required this.api, required this.address});

  final ApiClient api;
  final ValueNotifier<SelectedAddress?> address;

  @override
  State<AddressScreen> createState() => _AddressScreenState();
}

class _AddressScreenState extends State<AddressScreen> {
  final _controller = TextEditingController();
  List<GeocodeResult>? _results;
  String? _error;
  bool _loading = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    final q = _controller.text.trim();
    if (q.length < 3) {
      setState(() => _error = 'Digite o endereço ou o CEP.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await widget.api.geocode(q);
      if (!mounted) return;
      setState(() {
        _results = results;
        if (results.isEmpty) _error = 'Endereço não encontrado. Tente incluir número e cidade.';
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Sem conexão com o servidor.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _choose(SelectedAddress a) {
    widget.address.value = a;
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          NavyHeader(
            padding: const EdgeInsets.fromLTRB(4, 0, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconButton(
                  tooltip: 'Voltar',
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Onde você está?', style: theme.textTheme.headlineSmall?.copyWith(color: Colors.white)),
                      const SizedBox(height: 4),
                      const Text(
                        'Usamos o endereço só para encontrar quem atende você.',
                        style: TextStyle(color: Colors.white70),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        key: const Key('address-field'),
                        controller: _controller,
                        autofocus: true,
                        textInputAction: TextInputAction.search,
                        onSubmitted: (_) => _lookup(),
                        decoration: InputDecoration(
                          hintText: 'Rua e número, ou CEP',
                          prefixIcon: const Icon(Icons.location_on_outlined, color: LumeColors.orange),
                          enabledBorder: const OutlineInputBorder(
                            borderRadius: BorderRadius.all(Radius.circular(14)),
                            borderSide: BorderSide.none,
                          ),
                          suffixIcon: IconButton(
                            tooltip: 'Buscar endereço',
                            icon: const Icon(Icons.search),
                            onPressed: _loading ? null : _lookup,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (_loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Text(_error!, style: TextStyle(color: theme.colorScheme.error, fontWeight: FontWeight.w600)),
            ),
          if ((_results ?? const []).isNotEmpty)
            _Group(
              title: 'Resultados',
              children: [
                for (final r in _results!)
                  _AddressTile(
                    icon: Icons.location_on_outlined,
                    title: r.formattedAddress,
                    onTap: () => _choose(SelectedAddress(label: r.formattedAddress, location: r.location)),
                  ),
              ],
            ),
          if (_showDemo)
            _Group(
              title: 'Demonstração',
              children: [
                _AddressTile(
                  key: const Key('demo-address'),
                  icon: Icons.apartment,
                  title: demoAddress.label,
                  subtitle: 'Vila Mariana, São Paulo · dados fictícios',
                  onTap: () => _choose(demoAddress),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 8),
              child: Text(title, style: Theme.of(context).textTheme.titleSmall),
            ),
            Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (var i = 0; i < children.length; i++) ...[
                    if (i > 0) const Divider(indent: 56),
                    children[i],
                  ],
                ],
              ),
            ),
          ],
        ),
      );
}

class _AddressTile extends StatelessWidget {
  const _AddressTile({super.key, required this.icon, required this.title, this.subtitle, required this.onTap});
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: LumeColors.orangeSoft, borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: LumeColors.orange, size: 22),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: subtitle == null ? null : Text(subtitle!),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      );
}
