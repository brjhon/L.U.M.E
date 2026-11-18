// Gera screenshots das telas com fontes reais, para revisão visual.
// Não roda no `flutter test` normal (fica fora de test/). Uso:
//   flutter test test_screenshots --update-goldens
// Os PNGs saem em test_screenshots/goldens/ (a CI publica como artefato "screenshots").
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lume/main.dart';
import 'package:lume/src/api_client.dart';
import 'package:lume/src/screens/address_screen.dart' show demoAddress;
import 'package:material_ui/material_ui.dart';

Iterable<File> _find(Directory root, bool Function(String name) match) sync* {
  if (!root.existsSync()) return;
  for (final e in root.listSync(recursive: true, followLinks: false)) {
    if (e is File && match(e.uri.pathSegments.last)) yield e;
  }
}

Future<void> _loadFonts() async {
  final flutterRoot = Platform.environment['FLUTTER_ROOT'] ??
      File(Platform.resolvedExecutable).parent.parent.parent.parent.parent.parent.path;
  final fontsDir = Directory('$flutterRoot/bin/cache/artifacts/material_fonts');
  final pubCache = Platform.environment['PUB_CACHE'] ?? '${Platform.environment['HOME']}/.pub-cache';

  final roboto = FontLoader('Roboto');
  for (final f in _find(fontsDir, (n) => n.startsWith('Roboto') && n.endsWith('.ttf') && !n.contains('Condensed'))) {
    roboto.addFont(Future.value(ByteData.sublistView(f.readAsBytesSync())));
  }
  await roboto.load();

  // No iOS o tema usa a fonte do sistema (SF Pro), que não existe no Linux da CI:
  // a Roboto entra no lugar só para o screenshot. No aparelho, aparece a SF Pro.
  final robotoFiles =
      _find(fontsDir, (n) => n.startsWith('Roboto') && n.endsWith('.ttf') && !n.contains('Condensed')).toList();
  for (final family in ['CupertinoSystemText', 'CupertinoSystemDisplay', '.AppleSystemUIFont', '.SF Pro Text', '.SF Pro Display', '.SF UI Text', '.SF UI Display']) {
    final loader = FontLoader(family);
    for (final f in robotoFiles) {
      loader.addFont(Future.value(ByteData.sublistView(f.readAsBytesSync())));
    }
    await loader.load();
  }

  final candidates = [
    ..._find(fontsDir, (n) => n == 'MaterialIcons-Regular.otf'),
    ..._find(Directory('$pubCache/hosted/pub.dev'), (n) => n == 'MaterialIcons-Regular.otf'),
  ];
  if (candidates.isEmpty) throw StateError('MaterialIcons-Regular.otf não encontrado');
  final iconFile = candidates.first;
  final family = Icons.home.fontPackage == null
      ? Icons.home.fontFamily!
      : 'packages/${Icons.home.fontPackage}/${Icons.home.fontFamily}';
  for (final name in {family, 'MaterialIcons'}) {
    final icons = FontLoader(name)..addFont(Future.value(ByteData.sublistView(iconFile.readAsBytesSync())));
    await icons.load();
  }
}

const _cats = [
  ('alimentacao', 'Alimentação'),
  ('mercado', 'Mercado'),
  ('farmacia', 'Farmácia'),
  ('pets', 'Pets'),
  ('cuidados', 'Cuidados'),
  ('tecnologia', 'Tecnologia'),
  ('casa', 'Casa'),
  ('servicos-gerais', 'Serviços gerais'),
];

Map<String, Object?> _item(String id, String provider, String title, String slug, String cat, String mode,
        String? elig, int? dist) =>
    {
      'listingId': id,
      'title': title,
      'description': null,
      'mode': mode,
      'eligibility': elig,
      'distanceM': dist,
      'category': {'id': slug, 'slug': slug, 'name': cat},
      'provider': {'id': 'p$id', 'kind': 'BUSINESS', 'displayName': provider},
    };

final _results = [
  _item('l1', 'Pet Passeios', 'Passeio com cães', 'passeador-de-caes', 'Passeador de cães', 'AT_HOME', 'CONFIRMED', 399),
  _item('l2', 'Mercadinho Bom Preço', 'Entrega de compras do mês', 'mercado', 'Mercado', 'DELIVERY', 'CONFIRMED', 598),
  _item('l3', 'João Eletricista', 'Reparos e instalações elétricas', 'eletricista', 'Eletricista', 'AT_HOME',
      'CONFIRMED', 838),
  _item('l4', 'Farmácia Vida Plena', 'Farmácia 24 horas', 'farmacia', 'Farmácia', 'IN_STORE', null, 898),
  _item('l5', 'Pizzaria Forno a Lenha', 'Delivery de pizza', 'alimentacao', 'Alimentação', 'DELIVERY', 'UNCONFIRMED',
      1495),
  _item('l6', 'TecFácil Informática', 'Suporte remoto', 'tecnico-informatica', 'Técnico de informática', 'REMOTE',
      null, 1677),
];

MockClient _api() => MockClient((req) async {
      Object body;
      final path = req.url.path;
      if (path == '/v1/categories') {
        body = [
          for (final (slug, name) in _cats)
            {'id': slug, 'slug': slug, 'name': name, 'icon': null, 'sensitive': false, 'children': <Object>[]},
        ];
      } else if (path == '/v1/search') {
        final size = int.parse(req.url.queryParameters['pageSize'] ?? '20');
        body = {'items': _results.take(size).toList(), 'page': 1, 'pageSize': size, 'hasMore': false};
      } else if (path.startsWith('/v1/listings/')) {
        body = {
          'id': 'l2',
          'title': 'Entrega de compras do mês',
          'description': 'Pedidos por WhatsApp, entrega no mesmo dia.',
          'mode': 'DELIVERY',
          'eligibility': 'CONFIRMED',
          'distanceM': 598,
          'category': {'id': 'mercado', 'slug': 'mercado', 'name': 'Mercado'},
          'provider': {
            'id': 'p1',
            'kind': 'BUSINESS',
            'displayName': 'Mercadinho Bom Preço',
            'description': 'Mercado de bairro com hortifrúti e padaria.',
            'phone': '+5500000000001',
            'whatsapp': '5500000000001',
            'locations': [
              {
                'address': 'Rua Exemplo, 100 - Vila Mariana',
                'location': {'lat': -23.58, 'lng': -46.63},
              },
            ],
          },
        };
      } else {
        return http.Response('{}', 404);
      }
      return http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json; charset=utf-8'});
    });

Future<void> _shot(WidgetTester tester, String name) async {
  await tester.pumpAndSettle();
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
}

void main() {
  setUpAll(_loadFonts);

  Future<void> boot(WidgetTester tester, {bool withAddress = true, bool iphone = false}) async {
    tester.view.physicalSize = const Size(780, 1688); // 390 x 844 pt
    tester.view.devicePixelRatio = 2;
    if (iphone) {
      // Notch (47 pt) e indicador de início (34 pt) do iPhone, em pixels físicos.
      const insets = FakeViewPadding(top: 94, bottom: 68);
      tester.view.padding = insets;
      tester.view.viewPadding = insets;
    }
    addTearDown(tester.view.reset);
    await tester.pumpWidget(LumeApp(
      api: ApiClient(baseUrl: 'http://t', client: _api()),
      openUrl: (_) async => true,
      initialAddress: withAddress ? demoAddress : null,
    ));
  }

  testWidgets('01 início sem endereço', (tester) async {
    await boot(tester, withAddress: false);
    await _shot(tester, '01_inicio_sem_endereco');
  });

  testWidgets('02 início', (tester) async {
    await boot(tester);
    await _shot(tester, '02_inicio');
  });

  testWidgets('03 endereço', (tester) async {
    await boot(tester);
    await tester.tap(find.byKey(const Key('address-bar')));
    await _shot(tester, '03_endereco');
  });

  testWidgets('04 resultados', (tester) async {
    await boot(tester);
    await tester.tap(find.text('Buscar'));
    await _shot(tester, '04_resultados');
  });

  testWidgets('05 detalhe', (tester) async {
    await boot(tester);
    await tester.pumpAndSettle();
    final card = find.text('Mercadinho Bom Preço');
    await tester.scrollUntilVisible(card, 200, scrollable: find.byType(Scrollable).first);
    await tester.tap(card);
    await _shot(tester, '05_detalhe');
  });

  final iphone = TargetPlatformVariant.only(TargetPlatform.iOS);

  testWidgets('06 iPhone início', (tester) async {
    await boot(tester, iphone: true);
    await _shot(tester, '06_iphone_inicio');
  }, variant: iphone);

  testWidgets('07 iPhone resultados', (tester) async {
    await boot(tester, iphone: true);
    await tester.tap(find.text('Buscar'));
    await _shot(tester, '07_iphone_resultados');
  }, variant: iphone);

  testWidgets('08 iPhone detalhe', (tester) async {
    await boot(tester, iphone: true);
    await tester.pumpAndSettle();
    final card = find.text('Mercadinho Bom Preço');
    await tester.scrollUntilVisible(card, 200, scrollable: find.byType(Scrollable).first);
    await tester.tap(card);
    await _shot(tester, '08_iphone_detalhe');
  }, variant: iphone);
}
