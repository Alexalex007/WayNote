/// <reference types="google.maps" />
/// <reference types="vite/client" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Reorder } from 'motion/react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Activity, HotelBooking } from '../types';
import { DestinationAirport } from '../shared/destinationIntel';
import { AppLanguage, formatStopsCount, formatTimeDisplay } from '../shared/i18n';
import { useI18n } from '../hooks/useI18n';
import { LiquidModal, SlidingSegmentedControl } from './LiquidPrimitives';
import {
  NavigationArrowIcon,
  MapIcon,
  GripVerticalIcon,
  ClockIcon,
  CheckIcon,
  HomeIcon,
  PlaneIcon,
} from './Icons';

export interface PreviousStopOption {
  date: string;
  activity: Activity;
}

interface Props {
  open: boolean;
  onClose: () => void;
  stops: Activity[];
  destinationCity: string;
  hotels?: HotelBooking[];
  activeHotel?: HotelBooking | null;
  airports?: DestinationAirport[];
  previousStops?: PreviousStopOption[];
  onReorderStops: (nextStops: Activity[]) => void;
  onApplyToDay?: (orderedStops: Activity[]) => void;
  onOpenHotelsManager?: () => void;
}

interface ResolvedStop {
  lat: number;
  lng: number;
  displayName: string;
  formattedAddress: string;
}

type TravelModeOption = 'TRANSIT' | 'WALKING' | 'DRIVING';
type OriginMode = 'NONE' | 'HOTEL' | 'AIRPORT' | 'PREV_STOP';

interface OriginCandidate {
  id: string;
  label: string;
  query: string;
  subtitle?: string;
}

function isQuotaError(err: unknown): boolean {
  const msg = String(
    (err as { message?: string; code?: string; status?: string | number })?.message ||
      (err as { code?: string })?.code ||
      (err as { status?: string | number })?.status ||
      err ||
      ''
  ).toUpperCase();
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('OVERQUOTAMAPERROR') ||
    msg.includes('QUOTAEXCEEDEDERROR') ||
    msg.includes('429')
  );
}

function formatDurationMs(ms?: number | null, lang: AppLanguage = 'zh-TW'): string {
  if (!ms || ms <= 0) return '';
  const totalMin = Math.max(1, Math.round(ms / 60000));
  if (totalMin < 60) {
    if (lang === 'en') return `~${totalMin} min`;
    if (lang === 'zh-CN') return `约 ${totalMin} 分钟`;
    return `約 ${totalMin} 分鐘`;
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (lang === 'en') return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
  if (lang === 'zh-CN') return m > 0 ? `约 ${h} 小时 ${m} 分` : `约 ${h} 小时`;
  return m > 0 ? `約 ${h} 小時 ${m} 分` : `約 ${h} 小時`;
}

function formatDistanceMeters(meters?: number | null): string {
  if (!meters || meters <= 0) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

interface RouteApiRouteResult {
  createPolylines?: (opts?: unknown) => google.maps.Polyline[];
  distanceMeters?: number;
  durationMillis?: number;
  path?: google.maps.LatLngLiteral[];
}

interface RouteMapInnerProps {
  stops: Activity[];
  originCandidate: OriginCandidate | null;
  destinationCity: string;
  travelMode: TravelModeOption;
  selectedStopId: string | null;
  onSelectStop: (id: string | null) => void;
  onResolvedChange: (
    resolved: Record<string, ResolvedStop | null>,
    originPoint: ResolvedStop | null,
    resolving: boolean
  ) => void;
  onRouteSummary: (summary: { distanceText: string; durationText: string; usedFallback: boolean } | null) => void;
}

const RouteMapInner: React.FC<RouteMapInnerProps> = ({
  stops,
  originCandidate,
  destinationCity,
  travelMode,
  selectedStopId,
  onSelectStop,
  onResolvedChange,
  onRouteSummary,
}) => {
  const { lang, t } = useI18n();
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const coordsCacheRef = useRef<Record<string, ResolvedStop | null>>({});
  const [resolvedMap, setResolvedMap] = useState<Record<string, ResolvedStop | null>>({});
  const [resolvedOrigin, setResolvedOrigin] = useState<ResolvedStop | null>(null);
  const lastFitSignatureRef = useRef<string>('');

  // Resolve origin + stops via Places API (New) with query cache
  useEffect(() => {
    if (!placesLib || (stops.length === 0 && !originCandidate)) return;
    let cancelled = false;

    const buildQuery = (rawPlace: string) => {
      const clean = rawPlace.trim();
      if (!clean) return '';
      if (destinationCity && !clean.toLowerCase().includes(destinationCity.toLowerCase())) {
        return `${clean}, ${destinationCity}`;
      }
      return clean;
    };

    const resolveSingle = async (cacheKey: string, query: string, fallbackTitle: string): Promise<ResolvedStop | null> => {
      if (cacheKey in coordsCacheRef.current) {
        return coordsCacheRef.current[cacheKey];
      }
      if (!query) {
        coordsCacheRef.current[cacheKey] = null;
        return null;
      }
      try {
        const response = await placesLib.Place.searchByText({
          textQuery: query,
          fields: ['location', 'displayName', 'formattedAddress'],
          maxResultCount: 1,
          language: lang === 'en' ? 'en' : lang === 'zh-CN' ? 'zh-CN' : 'zh-TW',
        });
        const first = response.places?.[0];
        if (first?.location) {
          const point: ResolvedStop = {
            lat: first.location.lat(),
            lng: first.location.lng(),
            displayName: first.displayName || fallbackTitle,
            formattedAddress: first.formattedAddress || query,
          };
          coordsCacheRef.current[cacheKey] = point;
          return point;
        }
        coordsCacheRef.current[cacheKey] = null;
        return null;
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        coordsCacheRef.current[cacheKey] = null;
        return null;
      }
    };

    const resolveAll = async () => {
      const itemsToCheck: { key: string; query: string }[] = stops.map((stop) => {
        const q = buildQuery(stop.location || stop.title || '');
        return { key: `${stop.id}::${q}::${lang}`, query: q };
      });
      if (originCandidate) {
        const oq = originCandidate.query.trim();
        itemsToCheck.push({ key: `origin::${originCandidate.id}::${oq}::${lang}`, query: oq });
      }

      const hasPending = itemsToCheck.some((item) => !(item.key in coordsCacheRef.current));
      if (hasPending) {
        onResolvedChange(resolvedMap, resolvedOrigin, true);
      }

      const nextResolved: Record<string, ResolvedStop | null> = {};
      for (const stop of stops) {
        if (cancelled) return;
        const q = buildQuery(stop.location || stop.title || '');
        const key = `${stop.id}::${q}::${lang}`;
        nextResolved[stop.id] = await resolveSingle(key, q, stop.title);
      }

      let nextOrigin: ResolvedStop | null = null;
      if (originCandidate && !cancelled) {
        const oq = originCandidate.query.trim();
        const oKey = `origin::${originCandidate.id}::${oq}::${lang}`;
        nextOrigin = await resolveSingle(oKey, oq, originCandidate.label);
      }

      if (!cancelled) {
        setResolvedMap(nextResolved);
        setResolvedOrigin(nextOrigin);
        onResolvedChange(nextResolved, nextOrigin, false);
      }
    };

    resolveAll();
    return () => {
      cancelled = true;
    };
  }, [placesLib, stops, originCandidate, destinationCity, lang]);

  const orderedPoints = useMemo(() => {
    return stops
      .map((stop, index) => ({
        stop,
        index,
        point: resolvedMap[stop.id] || null,
      }))
      .filter((item): item is { stop: Activity; index: number; point: ResolvedStop } => item.point !== null);
  }, [stops, resolvedMap]);

  const fullRouteCoords = useMemo(() => {
    const pts: ResolvedStop[] = [];
    if (resolvedOrigin) pts.push(resolvedOrigin);
    orderedPoints.forEach((p) => pts.push(p.point));
    return pts;
  }, [resolvedOrigin, orderedPoints]);

  // Fit bounds when resolved markers arrive or selected stop changes
  useEffect(() => {
    if (!map || fullRouteCoords.length === 0) return;

    if (selectedStopId === '__ORIGIN__' && resolvedOrigin) {
      map.panTo({ lat: resolvedOrigin.lat, lng: resolvedOrigin.lng });
      return;
    }

    if (selectedStopId) {
      const target = orderedPoints.find((item) => item.stop.id === selectedStopId);
      if (target) {
        map.panTo({ lat: target.point.lat, lng: target.point.lng });
        return;
      }
    }

    const sig = fullRouteCoords.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
    if (sig !== lastFitSignatureRef.current) {
      if (fullRouteCoords.length === 1) {
        map.panTo({ lat: fullRouteCoords[0].lat, lng: fullRouteCoords[0].lng });
        map.setZoom(14);
      } else {
        const bounds = new google.maps.LatLngBounds();
        fullRouteCoords.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
      }
      lastFitSignatureRef.current = sig;
    }
  }, [map, fullRouteCoords, orderedPoints, resolvedOrigin, selectedStopId]);

  // Compute transit (rail priority, leg-by-leg), walking, or driving route via Routes API
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const activePolylines: google.maps.Polyline[] = [];
    const routeStrokeColor = travelMode === 'TRANSIT' ? '#4F46E5' : '#F26B3A';

    const drawFallbackPolyline = (pts: ResolvedStop[], dashed: boolean) => {
      if (pts.length < 2) return;
      const line = new google.maps.Polyline({
        path: pts.map((p) => ({ lat: p.lat, lng: p.lng })),
        geodesic: true,
        strokeColor: routeStrokeColor,
        strokeOpacity: dashed ? 0.55 : 0.88,
        strokeWeight: 4,
        map,
      });
      activePolylines.push(line);
    };

    if (fullRouteCoords.length < 2) {
      onRouteSummary(null);
      return () => {
        activePolylines.forEach((pl) => pl.setMap(null));
      };
    }

    const cappedPoints = fullRouteCoords.slice(0, 25);
    const coords = cappedPoints.map((p) => ({ lat: p.lat, lng: p.lng }));

    if (!routesLib) {
      drawFallbackPolyline(cappedPoints, true);
      return () => {
        activePolylines.forEach((pl) => pl.setMap(null));
      };
    }

    const drawPrimaryRoute = (primaryRoute: RouteApiRouteResult, legPts: ResolvedStop[]): boolean => {
      if (typeof primaryRoute.createPolylines === 'function') {
        const polylines = primaryRoute.createPolylines({
          polylineOptions: {
            strokeColor: routeStrokeColor,
            strokeOpacity: 0.92,
            strokeWeight: 5,
          },
        });
        if (Array.isArray(polylines) && polylines.length > 0) {
          polylines.forEach((pl) => {
            pl.setMap(map);
            activePolylines.push(pl);
          });
          return true;
        }
      }
      if (Array.isArray(primaryRoute.path) && primaryRoute.path.length > 1) {
        const line = new google.maps.Polyline({
          path: primaryRoute.path,
          strokeColor: routeStrokeColor,
          strokeOpacity: 0.92,
          strokeWeight: 5,
          map,
        });
        activePolylines.push(line);
        return true;
      }
      drawFallbackPolyline(legPts, true);
      return false;
    };

    const computeRoute = async () => {
      try {
        const routeApi = (
          routesLib as unknown as {
            Route?: {
              computeRoutes: (req: unknown) => Promise<{ routes?: RouteApiRouteResult[] }>;
            };
          }
        ).Route;

        if (!routeApi?.computeRoutes) {
          drawFallbackPolyline(cappedPoints, true);
          onRouteSummary({ distanceText: '', durationText: '', usedFallback: true });
          return;
        }

        // Google Routes API TRANSIT mode does not accept intermediate waypoints -> compute leg-by-leg with Rail priority
        if (travelMode === 'TRANSIT') {
          let totalDistance = 0;
          let totalDuration = 0;
          let anyFallback = false;

          const legPromises = coords.slice(0, -1).map(async (startCoord, idx) => {
            const endCoord = coords[idx + 1];
            const railReq = {
              origin: startCoord,
              destination: endCoord,
              travelMode: 'TRANSIT',
              transitPreference: {
                allowedTransitModes: ['RAIL', 'SUBWAY', 'TRAIN', 'TRAM'],
              },
              fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
            };

            let res = await routeApi.computeRoutes(railReq).catch(() => null);
            let route = res?.routes?.[0];

            // Fallback to general TRANSIT (rail + bus) if rail-only yields no route for a specific leg
            if (!route) {
              res = await routeApi
                .computeRoutes({
                  origin: startCoord,
                  destination: endCoord,
                  travelMode: 'TRANSIT',
                  fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
                })
                .catch(() => null);
              route = res?.routes?.[0];
            }

            return {
              route: route || null,
              pts: [cappedPoints[idx], cappedPoints[idx + 1]],
            };
          });

          const legResults = await Promise.all(legPromises);
          if (cancelled) return;

          for (const leg of legResults) {
            if (leg.route) {
              const ok = drawPrimaryRoute(leg.route, leg.pts);
              if (!ok) anyFallback = true;
              totalDistance += leg.route.distanceMeters || 0;
              totalDuration += leg.route.durationMillis || 0;
            } else {
              drawFallbackPolyline(leg.pts, true);
              anyFallback = true;
            }
          }

          onRouteSummary({
            distanceText: formatDistanceMeters(totalDistance),
            durationText: formatDurationMs(totalDuration, lang),
            usedFallback: anyFallback,
          });
          return;
        }

        // WALKING or DRIVING supports multi-stop intermediates directly
        const origin = coords[0];
        const destination = coords[coords.length - 1];
        const intermediates = coords.slice(1, -1).map((loc) => ({ location: loc }));

        const result = await routeApi.computeRoutes({
          origin,
          destination,
          intermediates: intermediates.length > 0 ? intermediates : undefined,
          travelMode,
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
        });

        if (cancelled) return;

        const primaryRoute = result.routes?.[0];
        if (primaryRoute) {
          const drawn = drawPrimaryRoute(primaryRoute, cappedPoints);
          onRouteSummary({
            distanceText: formatDistanceMeters(primaryRoute.distanceMeters),
            durationText: formatDurationMs(primaryRoute.durationMillis, lang),
            usedFallback: !drawn,
          });
        } else {
          drawFallbackPolyline(cappedPoints, true);
          onRouteSummary({ distanceText: '', durationText: '', usedFallback: true });
        }
      } catch (err) {
        if (cancelled) return;
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        drawFallbackPolyline(cappedPoints, true);
        onRouteSummary({ distanceText: '', durationText: '', usedFallback: true });
      }
    };

    computeRoute();

    return () => {
      cancelled = true;
      activePolylines.forEach((pl) => pl.setMap(null));
    };
  }, [map, routesLib, fullRouteCoords, travelMode, lang]);

  const selectedEntry = orderedPoints.find((item) => item.stop.id === selectedStopId) || null;
  const isOriginSelected = selectedStopId === '__ORIGIN__' && Boolean(resolvedOrigin);

  return (
    <>
      {resolvedOrigin && originCandidate && (
        <AdvancedMarker
          key={`origin_${originCandidate.id}`}
          position={{ lat: resolvedOrigin.lat, lng: resolvedOrigin.lng }}
          title={t(`起點：${originCandidate.label}`, `起点：${originCandidate.label}`, `Origin: ${originCandidate.label}`)}
          zIndex={isOriginSelected ? 45 : 30}
          onClick={() => onSelectStop('__ORIGIN__')}
        >
          <Pin
            background="#18181B"
            borderColor="#ffffff"
            glyphColor="#ffffff"
            scale={isOriginSelected ? 1.15 : 1.05}
          >
            <span className="font-bold text-[10px] leading-none text-white">{t('起', '起', 'O')}</span>
          </Pin>
        </AdvancedMarker>
      )}

      {orderedPoints.map(({ stop, index, point }) => {
        const isSelected = selectedStopId === stop.id;
        const pinColor = travelMode === 'TRANSIT' ? '#4F46E5' : '#F26B3A';
        return (
          <AdvancedMarker
            key={stop.id}
            position={{ lat: point.lat, lng: point.lng }}
            title={`${index + 1}. ${stop.title}`}
            zIndex={isSelected ? 40 : 10 + (stops.length - index)}
            onClick={() => onSelectStop(stop.id)}
          >
            <Pin
              background={isSelected ? '#18181B' : pinColor}
              borderColor="#ffffff"
              glyphColor="#ffffff"
              scale={isSelected ? 1.15 : 1}
            >
              <span className="font-num font-bold text-[11px] leading-none text-white">
                {index + 1}
              </span>
            </Pin>
          </AdvancedMarker>
        );
      })}

      {isOriginSelected && resolvedOrigin && originCandidate && (
        <InfoWindow
          position={{ lat: resolvedOrigin.lat, lng: resolvedOrigin.lng }}
          onCloseClick={() => onSelectStop(null)}
          pixelOffset={[0, -34]}
        >
          <div className="min-w-[160px] max-w-[230px] p-0.5 text-zinc-900">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="px-1.5 h-4 rounded-full bg-zinc-900 text-white text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                {t('起點', '起点', 'Origin')}
              </span>
              <span className="font-bold text-xs truncate">{originCandidate.label}</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2">
              {resolvedOrigin.formattedAddress}
            </p>
          </div>
        </InfoWindow>
      )}

      {selectedEntry && (
        <InfoWindow
          position={{ lat: selectedEntry.point.lat, lng: selectedEntry.point.lng }}
          onCloseClick={() => onSelectStop(null)}
          pixelOffset={[0, -34]}
        >
          <div className="min-w-[160px] max-w-[230px] p-0.5 text-zinc-900">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-4 h-4 rounded-full bg-[#F26B3A] text-white text-[10px] font-num font-bold inline-flex items-center justify-center shrink-0">
                {selectedEntry.index + 1}
              </span>
              <span className="font-bold text-xs truncate">{selectedEntry.stop.title}</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2">
              {selectedEntry.point.formattedAddress || selectedEntry.stop.location || selectedEntry.point.displayName}
            </p>
            {selectedEntry.stop.time && (
              <p className="text-[10px] font-num font-semibold text-[#F26B3A] mt-1">
                {(() => {
                  const td = formatTimeDisplay(selectedEntry.stop.time, lang);
                  return td.suffix ? `${td.main} ${td.suffix}` : td.main;
                })()}
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export const RouteMapModal: React.FC<Props> = ({
  open,
  onClose,
  stops,
  destinationCity,
  hotels = [],
  activeHotel = null,
  airports = [],
  previousStops = [],
  onReorderStops,
  onApplyToDay,
  onOpenHotelsManager,
}) => {
  const { lang, t } = useI18n();
  const [apiKey, setApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
  );
  const [keyChecked, setKeyChecked] = useState<boolean>(
    () => Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
  );
  // Default to Transit (Rail prioritized)
  const [travelMode, setTravelMode] = useState<TravelModeOption>('TRANSIT');
  const [originMode, setOriginMode] = useState<OriginMode>('NONE');
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [selectedAirportCode, setSelectedAirportCode] = useState<string>('');
  const [selectedPrevStopId, setSelectedPrevStopId] = useState<string>('');

  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [resolvedStops, setResolvedStops] = useState<Record<string, ResolvedStop | null>>({});
  const [resolvedOriginPoint, setResolvedOriginPoint] = useState<ResolvedStop | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [routeSummary, setRouteSummary] = useState<{
    distanceText: string;
    durationText: string;
    usedFallback: boolean;
  } | null>(null);
  const [hasReordered, setHasReordered] = useState(false);

  // Sync sensible defaults whenever modal opens or hotels/airports change
  useEffect(() => {
    if (!open) {
      setHasReordered(false);
      setSelectedStopId(null);
      return;
    }
    if (activeHotel) {
      setSelectedHotelId(activeHotel.id);
    } else if (hotels.length > 0 && !hotels.some((h) => h.id === selectedHotelId)) {
      setSelectedHotelId(hotels[0].id);
    }
    if (airports.length > 0 && !airports.some((a) => a.code === selectedAirportCode)) {
      setSelectedAirportCode(airports[0].code);
    }
    if (previousStops.length > 0 && !previousStops.some((p) => p.activity.id === selectedPrevStopId)) {
      setSelectedPrevStopId(previousStops[0].activity.id);
    }
  }, [open, activeHotel, hotels, airports, previousStops]);

  useEffect(() => {
    if (!open || apiKey) {
      if (apiKey) setKeyChecked(true);
      return;
    }
    let cancelled = false;
    fetch('/api/maps/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.apiKey) setApiKey(String(data.apiKey));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setKeyChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, apiKey]);

  const activeOriginCandidate = useMemo<OriginCandidate | null>(() => {
    if (originMode === 'HOTEL') {
      const h = hotels.find((item) => item.id === selectedHotelId) || activeHotel || hotels[0];
      if (!h) return null;
      return {
        id: `hotel_${h.id}`,
        label: h.name,
        query: h.address?.trim() ? `${h.name} ${h.address}` : `${h.name}, ${destinationCity}`,
        subtitle: `${h.checkIn.slice(5)}–${h.checkOut.slice(5)}`,
      };
    }
    if (originMode === 'AIRPORT') {
      const ap = airports.find((a) => a.code === selectedAirportCode) || airports[0];
      if (!ap) return null;
      return {
        id: `airport_${ap.code}`,
        label: ap.name,
        query: ap.query,
        subtitle: ap.code,
      };
    }
    if (originMode === 'PREV_STOP') {
      const prev =
        previousStops.find((p) => p.activity.id === selectedPrevStopId) || previousStops[0];
      if (!prev) return null;
      return {
        id: `prev_${prev.activity.id}`,
        label: prev.activity.title,
        query: `${prev.activity.location || prev.activity.title}, ${destinationCity}`,
        subtitle: prev.date.slice(5),
      };
    }
    return null;
  }, [originMode, hotels, selectedHotelId, activeHotel, destinationCity, airports, selectedAirportCode, previousStops, selectedPrevStopId]);

  const routeMapsUrl = useMemo(() => {
    if (stops.length === 0) return '#';
    const getQuery = (a: Activity) => encodeURIComponent(a.location || a.title);

    const modeParam =
      travelMode === 'WALKING' ? 'walking' : travelMode === 'DRIVING' ? 'driving' : 'transit';

    if (activeOriginCandidate) {
      const origin = encodeURIComponent(activeOriginCandidate.query);
      const destination = getQuery(stops[stops.length - 1]);
      const midStops = stops.slice(0, stops.length - 1).map(getQuery);
      const waypoints = midStops.length > 0 ? `&waypoints=${midStops.join('|')}` : '';
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}&travelmode=${modeParam}`;
    }

    const origin = getQuery(stops[0]);
    const destination = getQuery(stops[stops.length - 1]);
    let waypoints = '';
    if (stops.length > 2) {
      const points = stops.slice(1, stops.length - 1).map(getQuery);
      waypoints = `&waypoints=${points.join('|')}`;
    }
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}&travelmode=${modeParam}`;
  }, [stops, travelMode, activeOriginCandidate]);

  const handleReorder = (next: Activity[]) => {
    setHasReordered(true);
    onReorderStops(next);
  };

  return (
    <LiquidModal
      open={open}
      onClose={onClose}
      bottomSheetOnMobile
      maxWidthClass="max-w-4xl"
      title={
        <div className="flex items-center gap-2">
          <NavigationArrowIcon className="w-5 h-5 text-[#F26B3A]" />
          <span>{t('行程路線地圖', '行程路线地图', 'Route Map')}</span>
          <span className="text-xs font-num font-semibold text-zinc-400 dark:text-zinc-500">
            ({formatStopsCount(stops.length, lang)})
          </span>
        </div>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col gap-3.5 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-3.5 pr-0.5">
          {/* Top Controls: Transit (Rail Priority) -> Walking -> Driving (Last) + Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <SlidingSegmentedControl
              size="sm"
              value={travelMode}
              onChange={(val) => setTravelMode(val)}
              options={[
                { id: 'TRANSIT', label: t('大眾運輸 (鐵路)', '公共交通 (铁路)', 'Transit (Rail)'), accentFrom: '#4F46E5', accentTo: '#6366F1' },
                { id: 'WALKING', label: t('步行', '步行', 'Walk'), accentFrom: '#0E9F76', accentTo: '#10B981' },
                { id: 'DRIVING', label: t('駕車', '驾车', 'Drive'), accentFrom: '#F26B3A', accentTo: '#FB923C' },
              ]}
            />

            {routeSummary && (routeSummary.distanceText || routeSummary.durationText) && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-xs font-num font-semibold text-zinc-800 dark:text-zinc-200">
                {routeSummary.distanceText && <span>{routeSummary.distanceText}</span>}
                {routeSummary.distanceText && routeSummary.durationText && (
                  <span className="text-zinc-400">·</span>
                )}
                {routeSummary.durationText && (
                  <span className="text-[var(--tab-accent)] inline-flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5" />
                    {routeSummary.durationText}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Starting Origin Selector Bar */}
          <div className="rounded-2xl bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 p-2.5 space-y-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1.5 shrink-0">
                {t('出發起點：', '出发起点：', 'Start from:')}
              </span>
              <div className="overflow-x-auto no-scrollbar max-w-full">
                <SlidingSegmentedControl
                  size="sm"
                  value={originMode}
                  onChange={(val) => setOriginMode(val)}
                  options={[
                    { id: 'NONE', label: t('首站出發', '首站出发', 'First Stop'), accentFrom: '#27272A', accentTo: '#3F3F46' },
                    { id: 'HOTEL', label: t('酒店出發', '酒店出发', 'Hotel'), accentFrom: '#F26B3A', accentTo: '#FB923C' },
                    { id: 'AIRPORT', label: t('所在城市機場', '所在城市机场', 'Airport'), accentFrom: '#4F46E5', accentTo: '#6366F1' },
                    { id: 'PREV_STOP', label: t('上一站', '上一站', 'Prev Stop'), accentFrom: '#0E9F76', accentTo: '#10B981' },
                  ]}
                />
              </div>
            </div>

            {/* Sub-options when HOTEL / AIRPORT / PREV_STOP selected */}
            {originMode === 'HOTEL' && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-200/60 dark:border-white/10">
                {hotels.length === 0 ? (
                  <div className="flex items-center justify-between w-full px-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{t('尚未設定酒店位置', '尚未设置酒店位置', 'No hotel saved yet')}</span>
                    {onOpenHotelsManager && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenHotelsManager();
                        }}
                        className="text-xs font-semibold text-[#F26B3A] underline cursor-pointer"
                      >
                        {t('立即新增酒店 →', '立即添加酒店 →', 'Add hotel →')}
                      </button>
                    )}
                  </div>
                ) : (
                  hotels.map((h) => {
                    const picked = (selectedHotelId || activeHotel?.id || hotels[0].id) === h.id;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSelectedHotelId(h.id)}
                        className={`h-7 px-3 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          picked
                            ? 'bg-[#F26B3A] text-white'
                            : 'bg-white dark:bg-white/10 text-zinc-700 dark:text-zinc-200'
                        }`}
                      >
                        <HomeIcon className="w-3 h-3" />
                        <span>{h.name}</span>
                        <span className="font-num opacity-75">
                          ({h.checkIn.slice(5)}–{h.checkOut.slice(5)})
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {originMode === 'AIRPORT' && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-200/60 dark:border-white/10">
                {airports.map((ap) => {
                  const picked = (selectedAirportCode || airports[0]?.code) === ap.code;
                  return (
                    <button
                      key={ap.code}
                      type="button"
                      onClick={() => setSelectedAirportCode(ap.code)}
                      className={`h-7 px-3 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        picked
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-white/10 text-zinc-700 dark:text-zinc-200'
                      }`}
                    >
                      <PlaneIcon className="w-3 h-3" />
                      <span>{ap.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {originMode === 'PREV_STOP' && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-200/60 dark:border-white/10">
                {previousStops.length === 0 ? (
                  <span className="px-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {t('前面幾天尚無已安排的地點', '前面几天尚无已安排的地点', 'No earlier stops scheduled')}
                  </span>
                ) : (
                  previousStops.slice(0, 6).map((item) => {
                    const picked = (selectedPrevStopId || previousStops[0]?.activity.id) === item.activity.id;
                    return (
                      <button
                        key={item.activity.id}
                        type="button"
                        onClick={() => setSelectedPrevStopId(item.activity.id)}
                        className={`h-7 px-3 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          picked
                            ? 'bg-[#F26B3A] text-white'
                            : 'bg-white dark:bg-white/10 text-zinc-700 dark:text-zinc-200'
                        }`}
                      >
                        <span className="font-num opacity-75">{item.date.slice(5)}</span>
                        <span>{item.activity.title}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Interactive Map + Draggable Stops Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Embedded Interactive Google Map */}
            <div className="lg:col-span-7 relative rounded-2xl overflow-hidden border border-zinc-200/70 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900 h-[230px] sm:h-[320px] shrink-0">
              {apiKey ? (
                <APIProvider
                  apiKey={apiKey}
                  language={lang === 'en' ? 'en' : lang === 'zh-CN' ? 'zh-CN' : 'zh-TW'}
                >
                  <GoogleMap
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    defaultCenter={{ lat: 35.6762, lng: 139.6503 }}
                    defaultZoom={12}
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    streetViewControl={false}
                    mapTypeControl={false}
                    className="w-full h-full"
                  >
                    <RouteMapInner
                      stops={stops}
                      originCandidate={activeOriginCandidate}
                      destinationCity={destinationCity}
                      travelMode={travelMode}
                      selectedStopId={selectedStopId}
                      onSelectStop={setSelectedStopId}
                      onResolvedChange={(res, originPt, resolving) => {
                        setResolvedStops(res);
                        setResolvedOriginPoint(originPt);
                        setIsResolving(resolving);
                      }}
                      onRouteSummary={setRouteSummary}
                    />
                  </GoogleMap>
                </APIProvider>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 gap-2">
                  <MapIcon className="w-8 h-8 text-zinc-400" />
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {keyChecked
                      ? t(
                          '地圖載入受限，仍可使用下方拖曳排序並跳轉 Google Maps',
                          '地图加载受限，仍可使用下方拖拽排序并跳转 Google Maps',
                          'Map preview unavailable. You can still reorder stops below and open Google Maps.'
                        )
                      : t('正在載入互動地圖...', '正在加载交互地图...', 'Loading interactive map...')}
                  </p>
                </div>
              )}

              {isResolving && apiKey && (
                <div className="pointer-events-none absolute top-3 left-3 z-10 px-3 py-1 rounded-full bg-white/92 dark:bg-zinc-900/90 border border-zinc-200/70 dark:border-white/10 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 shadow-sm">
                  {t('正在定位座標與鐵路路線...', '正在定位坐标与铁路路线...', 'Locating stops & transit routes...')}
                </div>
              )}
            </div>

            {/* Drag-and-drop Reorderable Stop List */}
            <div className="lg:col-span-5 flex flex-col min-h-0">
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-2 px-0.5 shrink-0">
                <span>{t('拖曳手柄即可自由調整路線順序', '拖拽手柄即可自由调整路线顺序', 'Drag handles to reorder stops')}</span>
                <span className="font-num">{formatStopsCount(stops.length, lang)}</span>
              </div>

              <div className="lg:flex-1 lg:max-h-[294px] lg:overflow-y-auto no-scrollbar pr-0.5 space-y-2 pb-1">
                {activeOriginCandidate && (
                  <div
                    onClick={() => setSelectedStopId('__ORIGIN__')}
                    className={`p-2.5 rounded-2xl flex items-center gap-2.5 border cursor-pointer transition-colors ${
                      selectedStopId === '__ORIGIN__'
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-200/60 dark:bg-white/[0.06] border-zinc-300/60 dark:border-white/10'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {t('起', '起', 'S')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs truncate">{activeOriginCandidate.label}</div>
                      <div className="text-[11px] opacity-70 truncate">
                        {resolvedOriginPoint?.formattedAddress ||
                          activeOriginCandidate.subtitle ||
                          t('出發起點', '出发起点', 'Starting point')}
                      </div>
                    </div>
                  </div>
                )}

                <Reorder.Group
                  as="div"
                  axis="y"
                  values={stops}
                  onReorder={handleReorder}
                  className="space-y-2"
                >
                  {stops.map((loc, idx) => {
                    const isSelected = selectedStopId === loc.id;
                    const resolved = resolvedStops[loc.id];
                    return (
                      <Reorder.Item
                        as="div"
                        key={loc.id}
                        value={loc}
                        whileDrag={{
                          scale: 1.02,
                          boxShadow: '0 14px 30px -10px rgba(0, 0, 0, 0.25)',
                        }}
                        onClick={() => setSelectedStopId(loc.id)}
                        className={`p-3 rounded-2xl flex items-center gap-2.5 border transition-colors cursor-grab active:cursor-grabbing select-none ${
                          isSelected
                            ? 'bg-[#F26B3A]/10 dark:bg-[#F26B3A]/15 border-[#F26B3A]/40'
                            : 'bg-zinc-100/80 dark:bg-white/[0.04] border-zinc-200/70 dark:border-white/10 hover:bg-zinc-200/60 dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <GripVerticalIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                        <div
                          className={`w-6 h-6 rounded-full text-white flex items-center justify-center font-num font-bold text-xs shrink-0 ${
                            isSelected
                              ? 'bg-zinc-900 dark:bg-white dark:text-zinc-900'
                              : travelMode === 'TRANSIT'
                                ? 'bg-indigo-600'
                                : 'bg-[#F26B3A]'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-zinc-900 dark:text-white text-xs sm:text-sm truncate">
                            {loc.title}
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                            {resolved?.formattedAddress || loc.location || t('行程站點', '行程站点', 'Stop')}
                          </div>
                        </div>
                        {loc.time && (() => {
                          const fmt = formatTimeDisplay(loc.time, lang);
                          return (
                            <span className="text-[11px] font-num font-semibold text-zinc-400 shrink-0">
                              {fmt.main}
                              {fmt.suffix ? ` ${fmt.suffix}` : ''}
                            </span>
                          );
                        })()}
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2.5 border-t border-zinc-200/70 dark:border-white/10 shrink-0">
          {onApplyToDay && hasReordered && (
            <button
              type="button"
              onClick={() => {
                onApplyToDay(stops);
                setHasReordered(false);
              }}
              className="sm:flex-1 min-h-[44px] px-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <CheckIcon className="w-4 h-4" />
              <span>{t('套用此順序並更新時間', '应用此顺序并更新时间', 'Apply Order & Update Times')}</span>
            </button>
          )}
          <a
            href={routeMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="sm:flex-1 min-h-[44px] px-5 bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white rounded-full font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <MapIcon className="w-4 h-4" />
            <span>{t('開啟 Google Maps', '打开 Google Maps', 'Open in Google Maps')}</span>
          </a>
        </div>
      </div>
    </LiquidModal>
  );
};
