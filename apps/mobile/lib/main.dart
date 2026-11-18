import 'package:flutter/material.dart';

import 'src/api_client.dart';
import 'src/theme.dart';

void main() => runApp(const LumeApp());

class LumeApp extends StatelessWidget {
  const LumeApp({super.key, this.api});

  final ApiClient? api;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'L.U.M.E.',
      theme: buildLumeTheme(),
      home: HomeScreen(api: api ?? ApiClient()),
    );
  }
}

/// Categorias iniciais (as mesmas semeadas no banco).
const _categories = <(String, IconData)>[
  ('Mercados', Icons.shopping_basket_outlined),
  ('Serviços', Icons.build_outlined),
  ('Alimentação', Icons.restaurant_outlined),
  ('Saúde', Icons.local_pharmacy_outlined),
];

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('L.U.M.E.')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Comércios e serviços locais perto de você',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 16),
          const TextField(
            decoration: InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Buscar comércios ou serviços...',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final (label, icon) in _categories)
                Chip(avatar: Icon(icon, size: 18), label: Text(label)),
            ],
          ),
          const SizedBox(height: 24),
          FutureBuilder<Map<String, dynamic>>(
            future: api.health(),
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return const Text('Verificando API...');
              }
              if (snap.hasError) return const Text('API indisponível');
              return Text('API: ${snap.data?['status']}');
            },
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Início'),
          NavigationDestination(icon: Icon(Icons.search), label: 'Buscar'),
          NavigationDestination(icon: Icon(Icons.map_outlined), label: 'Mapa'),
          NavigationDestination(icon: Icon(Icons.favorite_border), label: 'Favoritos'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'Perfil'),
        ],
      ),
    );
  }
}
