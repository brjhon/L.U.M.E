import 'package:material_ui/material_ui.dart';

import '../api_client.dart';
import '../models.dart';
import '../widgets/brand.dart';
import 'home_screen.dart';
import 'results_screen.dart';

/// Navegação inferior (PDF, pág. 7). Favoritos e Perfil dependem de login (Sprint 1/4).
class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.api, required this.address, required this.openUrl});

  final ApiClient api;
  final ValueNotifier<SelectedAddress?> address;
  final UrlOpener openUrl;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _tab = 0;
  final _visited = <int>{0};

  @override
  Widget build(BuildContext context) {
    final tabs = [
      HomeScreen(api: widget.api, address: widget.address, openUrl: widget.openUrl),
      ResultsScreen(api: widget.api, address: widget.address, openUrl: widget.openUrl, embedded: true),
      const _ComingSoon(
        title: 'Favoritos',
        icon: Icons.favorite_border,
        message: 'Em breve você poderá salvar comércios e profissionais para achar rápido depois.',
      ),
      const _ComingSoon(
        title: 'Perfil',
        icon: Icons.person_outline,
        message: 'Em breve: entrar com sua conta e participar da comunidade do seu condomínio.',
      ),
    ];
    return Scaffold(
      // Cada aba só é montada na primeira visita (a aba Buscar não busca à toa) e depois mantém o estado.
      body: IndexedStack(
        index: _tab,
        children: [for (var i = 0; i < tabs.length; i++) _visited.contains(i) ? tabs[i] : const SizedBox()],
      ),
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))],
        ),
        child: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (i) => setState(() {
            _tab = i;
            _visited.add(i);
          }),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Início'),
            NavigationDestination(icon: Icon(Icons.search), label: 'Buscar'),
            NavigationDestination(
              icon: Icon(Icons.favorite_border),
              selectedIcon: Icon(Icons.favorite),
              label: 'Favoritos',
            ),
            NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Perfil'),
          ],
        ),
      ),
    );
  }
}

class _ComingSoon extends StatelessWidget {
  const _ComingSoon({required this.title, required this.icon, required this.message});
  final String title;
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          NavyHeader(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 18),
            child: Center(
              child: Text(title, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
            ),
          ),
          Expanded(child: Center(child: EmptyState(icon: icon, title: 'Em breve', message: message))),
        ],
      );
}
