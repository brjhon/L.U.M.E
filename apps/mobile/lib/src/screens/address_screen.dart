import 'package:material_ui/material_ui.dart';

import '../api_client.dart';
import '../models.dart';

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
    return Scaffold(
      appBar: AppBar(title: const Text('Onde você está?')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            key: const Key('address-field'),
            controller: _controller,
            autofocus: true,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _lookup(),
            decoration: InputDecoration(
              labelText: 'Endereço ou CEP',
              hintText: 'Ex.: Rua Domingos de Morais, 2000 ou 04010-100',
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                tooltip: 'Buscar endereço',
                icon: const Icon(Icons.search),
                onPressed: _loading ? null : _lookup,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Usamos o endereço só para encontrar quem atende você.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (_loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          for (final r in _results ?? const <GeocodeResult>[])
            ListTile(
              leading: const Icon(Icons.place_outlined),
              title: Text(r.formattedAddress),
              onTap: () => _choose(SelectedAddress(label: r.formattedAddress, location: r.location)),
            ),
          if (_showDemo) ...[
            const Divider(height: 32),
            ListTile(
              key: const Key('demo-address'),
              leading: const Icon(Icons.apartment_outlined),
              title: Text(demoAddress.label),
              subtitle: const Text('Vila Mariana, São Paulo · dados de demonstração'),
              onTap: () => _choose(demoAddress),
            ),
          ],
        ],
      ),
    );
  }
}
