import 'dart:convert';

import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform, kIsWeb;
import 'package:http/http.dart' as http;

import 'models.dart';

/// Erro da API no formato padrão (PDF, pág. 14).
class ApiException implements Exception {
  ApiException(this.statusCode, this.message);
  final int statusCode;
  final String message;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// Cliente da API L.U.M.E. Contrato em docs/openapi.json.
class ApiClient {
  ApiClient({String? baseUrl, http.Client? client})
      : baseUrl = baseUrl ?? defaultBaseUrl(),
        _client = client ?? http.Client();

  /// `--dart-define=API_URL=...` tem prioridade. Sem ele, aponta para a API local:
  /// o emulador Android enxerga o computador em 10.0.2.2; o simulador do iPhone, em localhost.
  static String defaultBaseUrl({bool? android}) {
    const fromEnv = String.fromEnvironment('API_URL');
    if (fromEnv.isNotEmpty) return fromEnv;
    final isAndroid = android ?? (!kIsWeb && defaultTargetPlatform == TargetPlatform.android);
    return isAndroid ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  }

  final String baseUrl;
  final http.Client _client;

  Uri _uri(String path, [Map<String, String?> query = const {}]) {
    final q = {
      for (final e in query.entries)
        if (e.value != null && e.value!.isNotEmpty) e.key: e.value!,
    };
    return Uri.parse('$baseUrl/v1$path').replace(queryParameters: q.isEmpty ? null : q);
  }

  Future<dynamic> _get(Uri uri) async {
    final res = await _client.get(uri);
    return _decode(res);
  }

  dynamic _decode(http.Response res) {
    final body = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 400) {
      final msg = body is Map ? body['message'] : null;
      throw ApiException(
        res.statusCode,
        msg is List ? msg.join(', ') : (msg?.toString() ?? 'Erro ${res.statusCode}'),
      );
    }
    return body;
  }

  Future<Map<String, dynamic>> health() async =>
      (await _get(_uri('/health'))) as Map<String, dynamic>;

  Future<List<Category>> categories() async {
    final list = (await _get(_uri('/categories'))) as List;
    return [for (final c in list) Category.fromJson(c as Map<String, dynamic>)];
  }

  Future<List<GeocodeResult>> geocode(String query) async {
    final list = (await _get(_uri('/geocode', {'q': query}))) as List;
    return [for (final r in list) GeocodeResult.fromJson(r as Map<String, dynamic>)];
  }

  Future<SearchPage> search({
    required SelectedAddress address,
    String? q,
    String? category,
    ServiceMode? mode,
    bool includeNotServed = false,
    int page = 1,
    int pageSize = 20,
  }) async {
    final json = await _get(_uri('/search', {
      'lat': address.location.lat.toString(),
      'lng': address.location.lng.toString(),
      'communityId': address.communityId,
      'q': q?.trim(),
      'category': category,
      'mode': mode?.api,
      'includeNotServed': includeNotServed ? 'true' : null,
      'page': '$page',
      'pageSize': '$pageSize',
    }));
    return SearchPage.fromJson(json as Map<String, dynamic>);
  }

  Future<ListingDetail> listing(String id, {SelectedAddress? address}) async {
    final json = await _get(_uri('/listings/$id', {
      'lat': address?.location.lat.toString(),
      'lng': address?.location.lng.toString(),
      'communityId': address?.communityId,
    }));
    return ListingDetail.fromJson(json as Map<String, dynamic>);
  }

  /// Registra clique em contato. Falhas não atrapalham o usuário.
  Future<void> contactEvent(String listingId, String channel, {String? communityId}) async {
    try {
      await _client.post(
        _uri('/listings/$listingId/contact-events'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({'channel': channel, if (communityId != null) 'communityId': communityId}),
      );
    } catch (_) {
      // Métrica apenas; nunca bloqueia o contato.
    }
  }
}
