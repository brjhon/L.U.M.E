/// Modelos espelhando o contrato docs/openapi.json.
library;

enum ServiceMode {
  delivery('DELIVERY', 'Entrega'),
  inStore('IN_STORE', 'Presencial'),
  atHome('AT_HOME', 'Em domicílio'),
  remote('REMOTE', 'Remoto');

  const ServiceMode(this.api, this.label);
  final String api;
  final String label;

  static ServiceMode parse(String v) => values.firstWhere((m) => m.api == v);
}

/// Elegibilidade da oferta para o endereço (PDF, pág. 12).
enum Eligibility {
  confirmed('CONFIRMED'),
  unconfirmed('UNCONFIRMED'),
  notServed('NOT_SERVED');

  const Eligibility(this.api);
  final String api;

  static Eligibility? parse(Object? v) =>
      v == null ? null : values.firstWhere((e) => e.api == v);
}

class GeoPoint {
  const GeoPoint(this.lat, this.lng);
  final double lat;
  final double lng;

  factory GeoPoint.fromJson(Map<String, dynamic> j) =>
      GeoPoint((j['lat'] as num).toDouble(), (j['lng'] as num).toDouble());
}

/// Endereço escolhido pelo usuário para a busca.
class SelectedAddress {
  const SelectedAddress({required this.label, required this.location, this.communityId});
  final String label;
  final GeoPoint location;
  final String? communityId;
}

class Category {
  const Category({
    required this.id,
    required this.slug,
    required this.name,
    this.icon,
    this.sensitive = false,
    this.children = const [],
  });

  final String id;
  final String slug;
  final String name;
  final String? icon;
  final bool sensitive;
  final List<Category> children;

  factory Category.fromJson(Map<String, dynamic> j) => Category(
        id: j['id'] as String,
        slug: j['slug'] as String,
        name: j['name'] as String,
        icon: j['icon'] as String?,
        sensitive: j['sensitive'] as bool? ?? false,
        children: [
          for (final c in (j['children'] as List? ?? const []))
            Category.fromJson(c as Map<String, dynamic>),
        ],
      );
}

class SearchItem {
  const SearchItem({
    required this.listingId,
    required this.title,
    required this.description,
    required this.mode,
    required this.eligibility,
    required this.distanceM,
    required this.categoryName,
    required this.providerName,
  });

  final String listingId;
  final String title;
  final String? description;
  final ServiceMode mode;
  final Eligibility? eligibility;
  final int? distanceM;
  final String categoryName;
  final String providerName;

  factory SearchItem.fromJson(Map<String, dynamic> j) => SearchItem(
        listingId: j['listingId'] as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        mode: ServiceMode.parse(j['mode'] as String),
        eligibility: Eligibility.parse(j['eligibility']),
        distanceM: (j['distanceM'] as num?)?.round(),
        categoryName: (j['category'] as Map<String, dynamic>)['name'] as String,
        providerName: (j['provider'] as Map<String, dynamic>)['displayName'] as String,
      );
}

class SearchPage {
  const SearchPage({required this.items, required this.hasMore});
  final List<SearchItem> items;
  final bool hasMore;

  factory SearchPage.fromJson(Map<String, dynamic> j) => SearchPage(
        items: [
          for (final i in j['items'] as List) SearchItem.fromJson(i as Map<String, dynamic>),
        ],
        hasMore: j['hasMore'] as bool,
      );
}

class ProviderLocation {
  const ProviderLocation(this.address, this.location);
  final String address;
  final GeoPoint location;
}

class ListingDetail {
  const ListingDetail({
    required this.id,
    required this.title,
    required this.description,
    required this.mode,
    required this.eligibility,
    required this.distanceM,
    required this.categoryName,
    required this.providerName,
    required this.providerDescription,
    required this.phone,
    required this.whatsapp,
    required this.locations,
  });

  final String id;
  final String title;
  final String? description;
  final ServiceMode mode;
  final Eligibility? eligibility;
  final int? distanceM;
  final String categoryName;
  final String providerName;
  final String? providerDescription;
  final String? phone;
  final String? whatsapp;
  final List<ProviderLocation> locations;

  factory ListingDetail.fromJson(Map<String, dynamic> j) {
    final p = j['provider'] as Map<String, dynamic>;
    return ListingDetail(
      id: j['id'] as String,
      title: j['title'] as String,
      description: j['description'] as String?,
      mode: ServiceMode.parse(j['mode'] as String),
      eligibility: Eligibility.parse(j['eligibility']),
      distanceM: (j['distanceM'] as num?)?.round(),
      categoryName: (j['category'] as Map<String, dynamic>)['name'] as String,
      providerName: p['displayName'] as String,
      providerDescription: p['description'] as String?,
      phone: p['phone'] as String?,
      whatsapp: p['whatsapp'] as String?,
      locations: [
        for (final l in (p['locations'] as List? ?? const []))
          ProviderLocation(
            (l as Map<String, dynamic>)['address'] as String,
            GeoPoint.fromJson(l['location'] as Map<String, dynamic>),
          ),
      ],
    );
  }
}

class GeocodeResult {
  const GeocodeResult(this.formattedAddress, this.location);
  final String formattedAddress;
  final GeoPoint location;

  factory GeocodeResult.fromJson(Map<String, dynamic> j) => GeocodeResult(
        j['formattedAddress'] as String,
        GeoPoint.fromJson(j['location'] as Map<String, dynamic>),
      );
}

/// "800 m", "1,7 km".
String formatDistance(int meters) {
  if (meters < 1000) return '${(meters / 10).round() * 10} m';
  final km = (meters / 100).round() / 10;
  return '${km.toStringAsFixed(1).replaceAll('.', ',')} km';
}
