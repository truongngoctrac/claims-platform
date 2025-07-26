import axios, { AxiosInstance } from 'axios';
import { MapsConfig, IntegrationResponse } from '../types';
import { IntegrationConfigManager } from '../config/IntegrationConfig';
import { RateLimitManager } from '../utils/RateLimitManager';
import { RetryManager } from '../utils/RetryManager';
import crypto from 'crypto';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Address {
  street?: string;
  ward?: string;
  district?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  formattedAddress: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: Address;
  coordinates: Coordinates;
  phoneNumber?: string;
  website?: string;
  rating?: number;
  priceLevel?: number;
  openingHours?: string[];
  types: string[];
}

export interface DistanceMatrix {
  distance: {
    text: string;
    value: number; // in meters
  };
  duration: {
    text: string;
    value: number; // in seconds
  };
  status: string;
}

export interface DirectionsRoute {
  legs: RouteLeg[];
  bounds: {
    northeast: Coordinates;
    southwest: Coordinates;
  };
  overviewPolyline: string;
  warnings: string[];
  waypoints: Coordinates[];
}

export interface RouteLeg {
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  startAddress: string;
  endAddress: string;
  startLocation: Coordinates;
  endLocation: Coordinates;
  steps: RouteStep[];
}

export interface RouteStep {
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  startLocation: Coordinates;
  endLocation: Coordinates;
  htmlInstructions: string;
  maneuver?: string;
}

export class MapsService {
  private configManager: IntegrationConfigManager;
  private rateLimitManager: RateLimitManager;
  private retryManager: RetryManager;
  private googleMapsClient?: AxiosInstance;

  constructor() {
    this.configManager = IntegrationConfigManager.getInstance();
    this.rateLimitManager = new RateLimitManager();
    this.retryManager = new RetryManager();
    this.initializeClients();
  }

  private initializeClients(): void {
    const config = this.configManager.getConfig<MapsConfig>('maps-google');
    
    if (config?.enabled && config.apiKey) {
      this.googleMapsClient = axios.create({
        baseURL: config.baseUrl,
        timeout: config.timeout,
        params: {
          key: config.apiKey,
          language: config.defaultLanguage || 'vi'
        }
      });
    }
  }

  public async geocodeAddress(address: string): Promise<IntegrationResponse<{
    coordinates: Coordinates;
    formattedAddress: string;
    addressComponents: Address;
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.googleMapsClient) {
        throw new Error('Maps service is not properly configured');
      }

      await this.rateLimitManager.checkRateLimit('maps-google', requestId);

      const result = await this.retryManager.executeWithRetry(
        () => this.executeGeocode(address),
        'maps-google'
      );

      return {
        success: true,
        data: result,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Geocoding failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeGeocode(address: string): Promise<{
    coordinates: Coordinates;
    formattedAddress: string;
    addressComponents: Address;
  }> {
    const response = await this.googleMapsClient!.get('/geocode/json', {
      params: { address }
    });

    if (response.data.status !== 'OK' || !response.data.results.length) {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }

    const result = response.data.results[0];
    const location = result.geometry.location;
    
    return {
      coordinates: {
        lat: location.lat,
        lng: location.lng
      },
      formattedAddress: result.formatted_address,
      addressComponents: this.parseAddressComponents(result.address_components)
    };
  }

  public async reverseGeocode(coordinates: Coordinates): Promise<IntegrationResponse<{
    address: Address;
    formattedAddress: string;
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.googleMapsClient) {
        throw new Error('Maps service is not properly configured');
      }

      await this.rateLimitManager.checkRateLimit('maps-google', requestId);

      const result = await this.retryManager.executeWithRetry(
        () => this.executeReverseGeocode(coordinates),
        'maps-google'
      );

      return {
        success: true,
        data: result,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reverse geocoding failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeReverseGeocode(coordinates: Coordinates): Promise<{
    address: Address;
    formattedAddress: string;
  }> {
    const response = await this.googleMapsClient!.get('/geocode/json', {
      params: {
        latlng: `${coordinates.lat},${coordinates.lng}`
      }
    });

    if (response.data.status !== 'OK' || !response.data.results.length) {
      throw new Error(`Reverse geocoding failed: ${response.data.status}`);
    }

    const result = response.data.results[0];
    
    return {
      address: this.parseAddressComponents(result.address_components),
      formattedAddress: result.formatted_address
    };
  }

  private parseAddressComponents(components: any[]): Address {
    const address: Address = { formattedAddress: '' };
    
    for (const component of components) {
      const types = component.types;
      
      if (types.includes('street_number') || types.includes('route')) {
        address.street = (address.street || '') + ' ' + component.long_name;
      } else if (types.includes('sublocality_level_1') || types.includes('ward')) {
        address.ward = component.long_name;
      } else if (types.includes('administrative_area_level_2') || types.includes('district')) {
        address.district = component.long_name;
      } else if (types.includes('locality') || types.includes('city')) {
        address.city = component.long_name;
      } else if (types.includes('administrative_area_level_1') || types.includes('province')) {
        address.province = component.long_name;
      } else if (types.includes('country')) {
        address.country = component.long_name;
      } else if (types.includes('postal_code')) {
        address.postalCode = component.long_name;
      }
    }
    
    address.street = address.street?.trim();
    return address;
  }

  public async findNearbyHospitals(
    coordinates: Coordinates,
    radius: number = 5000, // meters
    limit: number = 20
  ): Promise<IntegrationResponse<PlaceDetails[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.googleMapsClient) {
        throw new Error('Maps service is not properly configured');
      }

      await this.rateLimitManager.checkRateLimit('maps-google', requestId);

      const hospitals = await this.retryManager.executeWithRetry(
        () => this.executeNearbySearch(coordinates, 'hospital', radius, limit),
        'maps-google'
      );

      return {
        success: true,
        data: hospitals,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Nearby hospitals search failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async findNearbyPharmacies(
    coordinates: Coordinates,
    radius: number = 2000, // meters
    limit: number = 15
  ): Promise<IntegrationResponse<PlaceDetails[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.googleMapsClient) {
        throw new Error('Maps service is not properly configured');
      }

      await this.rateLimitManager.checkRateLimit('maps-google', requestId);

      const pharmacies = await this.retryManager.executeWithRetry(
        () => this.executeNearbySearch(coordinates, 'pharmacy', radius, limit),
        'maps-google'
      );

      return {
        success: true,
        data: pharmacies,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Nearby pharmacies search failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeNearbySearch(
    coordinates: Coordinates,
    type: string,
    radius: number,
    limit: number
  ): Promise<PlaceDetails[]> {
    const response = await this.googleMapsClient!.get('/place/nearbysearch/json', {
      params: {
        location: `${coordinates.lat},${coordinates.lng}`,
        radius,
        type,
        language: 'vi'
      }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Nearby search failed: ${response.data.status}`);
    }

    const places = response.data.results.slice(0, limit);
    const placeDetails: PlaceDetails[] = [];

    // Get detailed information for each place
    for (const place of places) {
      try {
        const details = await this.getPlaceDetails(place.place_id);
        if (details.success) {
          placeDetails.push(details.data!);
        }
      } catch (error) {
        // Continue with basic information if details fetch fails
        placeDetails.push({
          placeId: place.place_id,
          name: place.name,
          address: {
            formattedAddress: place.vicinity || place.formatted_address || ''
          },
          coordinates: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng
          },
          rating: place.rating,
          priceLevel: place.price_level,
          types: place.types || []
        });
      }
    }

    return placeDetails;
  }

  public async getPlaceDetails(placeId: string): Promise<IntegrationResponse<PlaceDetails>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.googleMapsClient) {
        throw new Error('Maps service is not properly configured');
      }

      await this.rateLimitManager.checkRateLimit('maps-google', requestId);

      const details = await this.retryManager.executeWithRetry(
        () => this.executePlaceDetails(placeId),
        'maps-google'
      );

      return {
        success: true,
        data: details,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Place details fetch failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executePlaceDetails(placeId: string): Promise<PlaceDetails> {
    const response = await this.googleMapsClient!.get('/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'place_id,name,formatted_address,geometry,formatted_phone_number,website,rating,price_level,opening_hours,types,address_components'
      }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Place details failed: ${response.data.status}`);
    }

    const place = response.data.result;
    
    return {
      placeId: place.place_id,
      name: place.name,
      address: {
        ...this.parseAddressComponents(place.address_components || []),
        formattedAddress: place.formatted_address
      },
      coordinates: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      },
      phoneNumber: place.formatted_phone_number,
      website: place.website,
      rating: place.rating,
      priceLevel: place.price_level,
      openingHours: place.opening_hours?.weekday_text,
      types: place.types || []
    };
  }

  public async calculateDistance(
    origins: Coordinates[],
    destinations: Coordinates[]
  ): Promise<IntegrationResponse<DistanceMatrix[][]>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.googleMapsClient) {
        throw new Error('Maps service is not properly configured');
      }

      await this.rateLimitManager.checkRateLimit('maps-google', requestId);

      const matrix = await this.retryManager.executeWithRetry(
        () => this.executeDistanceMatrix(origins, destinations),
        'maps-google'
      );

      return {
        success: true,
        data: matrix,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Distance calculation failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeDistanceMatrix(
    origins: Coordinates[],
    destinations: Coordinates[]
  ): Promise<DistanceMatrix[][]> {
    const originsParam = origins.map(coord => `${coord.lat},${coord.lng}`).join('|');
    const destinationsParam = destinations.map(coord => `${coord.lat},${coord.lng}`).join('|');
    
    const response = await this.googleMapsClient!.get('/distancematrix/json', {
      params: {
        origins: originsParam,
        destinations: destinationsParam,
        units: 'metric',
        mode: 'driving',
        avoid: 'tolls'
      }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Distance matrix failed: ${response.data.status}`);
    }

    return response.data.rows.map((row: any) => 
      row.elements.map((element: any) => ({
        distance: element.distance || { text: 'N/A', value: 0 },
        duration: element.duration || { text: 'N/A', value: 0 },
        status: element.status
      }))
    );
  }

  public async getDirections(
    origin: Coordinates,
    destination: Coordinates,
    waypoints?: Coordinates[]
  ): Promise<IntegrationResponse<DirectionsRoute[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.googleMapsClient) {
        throw new Error('Maps service is not properly configured');
      }

      await this.rateLimitManager.checkRateLimit('maps-google', requestId);

      const routes = await this.retryManager.executeWithRetry(
        () => this.executeDirections(origin, destination, waypoints),
        'maps-google'
      );

      return {
        success: true,
        data: routes,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Directions calculation failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeDirections(
    origin: Coordinates,
    destination: Coordinates,
    waypoints?: Coordinates[]
  ): Promise<DirectionsRoute[]> {
    const params: any = {
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      mode: 'driving',
      avoid: 'tolls',
      alternatives: true
    };

    if (waypoints && waypoints.length > 0) {
      params.waypoints = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
    }

    const response = await this.googleMapsClient!.get('/directions/json', { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Directions failed: ${response.data.status}`);
    }

    return response.data.routes.map((route: any) => ({
      legs: route.legs.map((leg: any) => ({
        distance: leg.distance,
        duration: leg.duration,
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        startLocation: leg.start_location,
        endLocation: leg.end_location,
        steps: leg.steps.map((step: any) => ({
          distance: step.distance,
          duration: step.duration,
          startLocation: step.start_location,
          endLocation: step.end_location,
          htmlInstructions: step.html_instructions,
          maneuver: step.maneuver
        }))
      })),
      bounds: route.bounds,
      overviewPolyline: route.overview_polyline.points,
      warnings: route.warnings || [],
      waypoints: route.waypoint_order ? 
        route.waypoint_order.map((index: number) => waypoints![index]) : []
    }));
  }

  public async findOptimalRoute(
    startLocation: Coordinates,
    destinations: Coordinates[]
  ): Promise<IntegrationResponse<{
    optimizedOrder: number[];
    totalDistance: number;
    totalDuration: number;
    route: DirectionsRoute;
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.googleMapsClient) {
        throw new Error('Maps service is not properly configured');
      }

      // For simplicity, we'll use the first destination as the end point
      // and others as waypoints. In a real implementation, you might want
      // to solve the Traveling Salesman Problem for true optimization
      const endDestination = destinations[destinations.length - 1];
      const waypoints = destinations.slice(0, -1);

      const directionsResponse = await this.getDirections(startLocation, endDestination, waypoints);
      
      if (!directionsResponse.success) {
        throw new Error(directionsResponse.error);
      }

      const route = directionsResponse.data![0];
      const totalDistance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
      const totalDuration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);

      return {
        success: true,
        data: {
          optimizedOrder: Array.from({ length: destinations.length }, (_, i) => i),
          totalDistance,
          totalDuration,
          route
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Route optimization failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async validateVietnameseAddress(address: string): Promise<IntegrationResponse<{
    isValid: boolean;
    formattedAddress?: string;
    coordinates?: Coordinates;
    confidence: number;
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      // Try to geocode the address
      const geocodeResponse = await this.geocodeAddress(address);
      
      if (!geocodeResponse.success) {
        return {
          success: true,
          data: {
            isValid: false,
            confidence: 0
          },
          requestId,
          timestamp: new Date()
        };
      }

      // Check if the result is in Vietnam
      const addressComponents = geocodeResponse.data!.addressComponents;
      const isInVietnam = addressComponents.country === 'Vietnam' || 
                         addressComponents.country === 'Việt Nam';

      return {
        success: true,
        data: {
          isValid: isInVietnam,
          formattedAddress: geocodeResponse.data!.formattedAddress,
          coordinates: geocodeResponse.data!.coordinates,
          confidence: isInVietnam ? 0.9 : 0.3
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Address validation failed',
        requestId,
        timestamp: new Date()
      };
    }
  }
}
