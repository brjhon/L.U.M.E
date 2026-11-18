import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lume/main.dart';
import 'package:lume/src/api_client.dart';

void main() {
  testWidgets('tela inicial mostra busca, categorias e status da API', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((_) async => http.Response('{"status":"ok"}', 200)),
    );
    await tester.pumpWidget(LumeApp(api: api));
    await tester.pumpAndSettle();

    expect(find.text('Buscar comércios ou serviços...'), findsOneWidget);
    expect(find.text('Mercados'), findsOneWidget);
    expect(find.text('API: ok'), findsOneWidget);
  });
}
