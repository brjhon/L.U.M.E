import { Module } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { GeocodingController } from './geocoding.controller';
import { GEOCODER, GEOCODER_FETCH, GeocodingService, GoogleGeocoder, NominatimGeocoder, type Geocoder } from './geocoding.service';

@Module({
  controllers: [GeocodingController],
  providers: [
    {
      provide: GEOCODER,
      useFactory: (): Geocoder => {
        const env = loadEnv();
        return env.googleMapsApiKey
          ? new GoogleGeocoder(env.googleMapsApiKey)
          : new NominatimGeocoder(env.geocoderUserAgent);
      },
    },
    { provide: GEOCODER_FETCH, useValue: fetch },
    GeocodingService,
  ],
})
export class GeocodingModule {}
