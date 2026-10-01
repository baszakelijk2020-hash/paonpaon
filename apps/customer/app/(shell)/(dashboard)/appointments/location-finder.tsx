"use client";

import { useMemo, useState } from "react";

import type { BookableBranch } from "./booking-flow";

type Position = { latitude: number; longitude: number };

function distanceKm(from: Position, branch: BookableBranch) {
  if (branch.latitude === undefined || branch.longitude === undefined)
    return null;
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = radians(branch.latitude - from.latitude);
  const dLng = radians(branch.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(branch.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function LocationFinder({
  branches,
  selectedBranchId,
  onSelect,
}: {
  branches: readonly BookableBranch[];
  selectedBranchId: string;
  onSelect: (branch: BookableBranch) => void;
}) {
  const [position, setPosition] = useState<Position | null>(null);
  const [locationState, setLocationState] = useState<
    "idle" | "finding" | "unavailable"
  >("idle");
  const ranked = useMemo(
    () =>
      [...branches]
        .map((branch) => ({
          branch,
          distance: position ? distanceKm(position, branch) : null,
        }))
        .sort(
          (a, b) =>
            (a.distance ?? Number.POSITIVE_INFINITY) -
            (b.distance ?? Number.POSITIVE_INFINITY),
        ),
    [branches, position],
  );
  const locate = () => {
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      return;
    }
    setLocationState("finding");
    navigator.geolocation.getCurrentPosition(
      (current) => {
        setPosition({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        setLocationState("idle");
      },
      () => setLocationState("unavailable"),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 },
    );
  };
  return (
    <div className="location-finder">
      <div className="location-finder-head">
        <div>
          <span className="location-finder-kicker">Find an atelier</span>
          <p>{position ? "Ateliers nearest to you" : "Choose a location"}</p>
        </div>
        <button
          type="button"
          className="location-finder-locate"
          onClick={locate}
          disabled={locationState === "finding"}
        >
          {locationState === "finding" ? "Finding you…" : "Use my location"}
        </button>
      </div>
      {locationState === "unavailable" ? (
        <p className="location-finder-note">
          We could not access your location. Choose an atelier below.
        </p>
      ) : null}
      <div className="location-finder-list">
        {ranked.map(({ branch, distance }, index) => (
          <button
            key={branch.id}
            type="button"
            className="location-finder-option"
            aria-pressed={branch.id === selectedBranchId}
            onClick={() => onSelect(branch)}
          >
            <span className="location-finder-pin" aria-hidden="true" />
            <span className="location-finder-copy">
              <strong>{branch.name}</strong>
              {branch.address ? <small>{branch.address}</small> : null}
              {position && index === 0 && distance !== null ? (
                <em>Closest atelier</em>
              ) : null}
            </span>
            {distance !== null ? (
              <span className="location-finder-distance">
                {distance < 1
                  ? `${Math.round(distance * 1000)} m`
                  : `${distance.toFixed(1)} km`}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
