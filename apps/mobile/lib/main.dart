import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import 'src/api_client.dart';
import 'src/models.dart';
import 'src/screens/results_screen.dart' show UrlOpener;
import 'src/screens/shell.dart';
import 'src/theme.dart';

void main() => runApp(LumeApp());

Future<bool> _launchExternal(Uri uri) => launchUrl(uri, mode: LaunchMode.externalApplication);

class LumeApp extends StatelessWidget {
  LumeApp({super.key, ApiClient? api, UrlOpener? openUrl, SelectedAddress? initialAddress})
      : api = api ?? ApiClient(),
        openUrl = openUrl ?? _launchExternal,
        address = ValueNotifier<SelectedAddress?>(initialAddress);

  final ApiClient api;
  final UrlOpener openUrl;

  /// Endereço escolhido para a busca (estado global simples do MVP).
  final ValueNotifier<SelectedAddress?> address;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'L.U.M.E.',
      debugShowCheckedModeBanner: false,
      theme: buildLumeTheme(),
      home: AppShell(api: api, address: address, openUrl: openUrl),
    );
  }
}
