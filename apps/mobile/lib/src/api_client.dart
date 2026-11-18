import 'dart:convert';

import 'package:http/http.dart' as http;

/// Cliente mínimo da API. Nos próximos sprints será gerado a partir de docs/openapi.json.
class ApiClient {
  ApiClient({String? baseUrl, http.Client? client})
      : baseUrl = baseUrl ??
            const String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3000'),
        _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  Future<Map<String, dynamic>> health() async {
    final res = await _client.get(Uri.parse('$baseUrl/v1/health'));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
