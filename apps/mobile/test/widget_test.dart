import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lume/main.dart';
import 'package:lume/src/api_client.dart';
import 'package:lume/src/models.dart';
import 'package:lume/src/widgets/category_visuals.dart';
import 'package:lume/src/widgets/eligibility_badge.dart';
import 'package:material_ui/material_ui.dart';

const _cat = {'id': 'c1', 'slug': 'mercado', 'name': 'Mercado'};
const _provider = {'id': 'p1', 'kind': 'BUSINESS', 'displayName': 'Mercadinho Bom Preço'};

Map<String, Object?> _item(String id, String title, String mode, String? eligibility, int? distance) => {
      'listingId': id,
      'title': title,
      'description': null,
      'mode': mode,
      'eligibility': eligibility,
      'distanceM': distance,
      'category': _cat,
      'provider': _provider,
    };

/// API falsa que responde como a real (contrato em docs/openapi.json).
MockClient fakeApi({List<Uri>? calls, List<Map<String, Object?>>? items}) => MockClient((req) async {
      calls?.add(req.url);
      Object? body;
      switch (req.url.path) {
        case '/v1/categories':
          body = [
            {..._cat, 'icon': 'shopping_cart', 'sensitive': false, 'children': <Object>[]},
            {
              'id': 'c2',
              'slug': 'cuidados',
              'name': 'Cuidados',
              'icon': 'favorite',
              'sensitive': true,
              'children': <Object>[],
            },
          ];
        case '/v1/search':
          final notServed = req.url.queryParameters['includeNotServed'] == 'true';
          body = {
            'items': items ??
                [
                  _item('l1', 'Entrega de compras', 'DELIVERY', 'CONFIRMED', 598),
                  _item('l2', 'Loja e padaria', 'IN_STORE', null, 598),
                  _item('l3', 'Delivery de pizza', 'DELIVERY', 'UNCONFIRMED', 1495),
                  if (notServed) _item('l4', 'Marmitas', 'DELIVERY', 'NOT_SERVED', 5002),
                ],
            'page': 1,
            'pageSize': 20,
            'hasMore': false,
          };
        case '/v1/listings/l1':
          body = {
            'id': 'l1',
            'title': 'Entrega de compras',
            'description': 'Entrega no mesmo dia.',
            'mode': 'DELIVERY',
            'eligibility': 'CONFIRMED',
            'distanceM': 598,
            'category': _cat,
            'provider': {
              ..._provider,
              'description': null,
              'phone': '+5500000000001',
              'whatsapp': '5500000000001',
              'locations': [
                {
                  'address': 'Rua Exemplo, 100',
                  'location': {'lat': -23.58, 'lng': -46.63},
                },
              ],
            },
          };
        case '/v1/listings/l1/contact-events':
          return http.Response('', 204);
        case '/v1/geocode':
          body = [
            {
              'formattedAddress': 'Rua Exemplo, 1 - São Paulo',
              'location': {'lat': -23.5, 'lng': -46.6},
              'postalCode': null,
            },
          ];
        default:
          return http.Response('{"statusCode":404,"message":"x"}', 404);
      }
      return http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json; charset=utf-8'});
    });

void main() {
  testWidgets('início mostra endereço, busca e categorias vindas da API', (tester) async {
    await tester.pumpWidget(LumeApp(api: ApiClient(baseUrl: 'http://t', client: fakeApi())));
    await tester.pumpAndSettle();

    expect(find.text('Informe seu endereço'), findsOneWidget);
    expect(find.text('Buscar comércios ou serviços...'), findsOneWidget);
    expect(find.text('Mercado'), findsOneWidget);
    expect(find.text('Cuidados'), findsOneWidget);
  });

  testWidgets('sem endereço, a busca pede o endereço antes; geocodifica e mostra resultados', (tester) async {
    final calls = <Uri>[];
    await tester.pumpWidget(LumeApp(api: ApiClient(baseUrl: 'http://t', client: fakeApi(calls: calls))));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('search-field')), 'mercado');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(find.text('Onde você está?'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('address-field')), 'Rua Exemplo 1');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Rua Exemplo, 1 - São Paulo'));
    await tester.pumpAndSettle();

    expect(find.text('Resultados para "mercado"'), findsOneWidget);
    final search = calls.lastWhere((u) => u.path == '/v1/search');
    expect(search.queryParameters, containsPair('q', 'mercado'));
    expect(search.queryParameters, containsPair('lat', '-23.5'));
  });

  testWidgets('resultados mostram o selo certo para cada caso', (tester) async {
    await tester.pumpWidget(LumeApp(
      api: ApiClient(baseUrl: 'http://t', client: fakeApi()),
      initialAddress: const SelectedAddress(label: 'Casa', location: GeoPoint(-23.5, -46.6)),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(CategoryTile, 'Mercado'));
    await tester.pumpAndSettle();

    expect(find.text('Entrega no seu endereço'), findsOneWidget);
    expect(find.text('Ir até o local'), findsOneWidget);
    expect(find.text('Atendimento não confirmado'), findsOneWidget);
    expect(find.text('Não atende seu endereço'), findsNothing);

    final showAll = find.text('Mostrar também quem não atende este endereço');
    final list = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down);
    await tester.scrollUntilVisible(showAll, 200, scrollable: list);
    await tester.tap(showAll);
    await tester.pumpAndSettle();
    expect(find.text('Não atendem seu endereço'), findsOneWidget); // seção separada
    expect(find.text('Não atende seu endereço'), findsOneWidget);
  });

  testWidgets('sem resultados, oferece ver quem não atende', (tester) async {
    await tester.pumpWidget(LumeApp(
      api: ApiClient(baseUrl: 'http://t', client: fakeApi(items: const [])),
      initialAddress: const SelectedAddress(label: 'Casa', location: GeoPoint(0, 0)),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(CategoryTile, 'Mercado'));
    await tester.pumpAndSettle();
    expect(find.text('Ninguém confirmou atendimento neste endereço ainda.'), findsOneWidget);
    expect(find.text('Ver também quem não atende'), findsOneWidget);
  });

  testWidgets('detalhe abre WhatsApp e registra o clique', (tester) async {
    final calls = <Uri>[];
    final opened = <Uri>[];
    await tester.pumpWidget(LumeApp(
      api: ApiClient(baseUrl: 'http://t', client: fakeApi(calls: calls)),
      openUrl: (uri) async {
        opened.add(uri);
        return true;
      },
      initialAddress: const SelectedAddress(label: 'Casa', location: GeoPoint(-23.5, -46.6)),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(CategoryTile, 'Mercado'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Entrega de compras').hitTestable());
    await tester.pumpAndSettle();

    expect(find.text('WhatsApp'), findsOneWidget);
    expect(find.text('Ligar'), findsOneWidget);
    expect(find.text('Como chegar'), findsOneWidget);

    await tester.ensureVisible(find.byKey(const Key('btn-whatsapp')));
    await tester.tap(find.byKey(const Key('btn-whatsapp')));
    await tester.pumpAndSettle();
    expect(opened.single.toString(), 'https://wa.me/5500000000001');
    expect(calls.any((u) => u.path == '/v1/listings/l1/contact-events'), isTrue);
  });

  testWidgets('início com endereço mostra destaques; abas Favoritos e Perfil avisam "em breve"', (tester) async {
    await tester.pumpWidget(LumeApp(
      api: ApiClient(baseUrl: 'http://t', client: fakeApi()),
      initialAddress: const SelectedAddress(label: 'Casa', location: GeoPoint(-23.5, -46.6)),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Destaques na sua região'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Entrega de compras'), 200,
        scrollable: find.byType(Scrollable).first);
    expect(find.text('Entrega de compras'), findsOneWidget);

    await tester.tap(find.text('Favoritos'));
    await tester.pumpAndSettle();
    expect(find.text('Em breve'), findsOneWidget);
  });

  test('selo "atende" só com elegibilidade confirmada', () {
    expect(EligibilityBadge.describe(ServiceMode.atHome, Eligibility.confirmed).$1, 'Atende seu endereço');
    expect(EligibilityBadge.describe(ServiceMode.atHome, null).$1, 'Atendimento não confirmado');
    expect(EligibilityBadge.describe(ServiceMode.inStore, Eligibility.confirmed).$1, 'Ir até o local');
  });

  test('formata distância', () {
    expect(formatDistance(398), '400 m');
    expect(formatDistance(1677), '1,7 km');
  });
}
