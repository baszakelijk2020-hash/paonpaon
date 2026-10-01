"use client";

import { useEffect, useId, useState } from "react";

interface AddressValue {
  city: string;
  line1: string;
  postalCode: string;
}

interface AddressSuggestion extends AddressValue {
  displayName: string;
}

export function AddressSearchFields({
  initialAddress,
  label,
}: {
  initialAddress: AddressValue | undefined;
  label: "home" | "work";
}) {
  const [value, setValue] = useState<AddressValue>({
    city: initialAddress?.city ?? "",
    line1: initialAddress?.line1 ?? "",
    postalCode: initialAddress?.postalCode ?? "",
  });
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const resultsId = useId();

  useEffect(() => {
    const query = value.line1.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/address-search?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
          },
        );
        const data = (await response.json()) as {
          results?: AddressSuggestion[];
        };
        setSuggestions(data.results ?? []);
        setIsOpen(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 240);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value.line1]);

  const update = (field: keyof AddressValue, nextValue: string) => {
    setValue((current) => ({ ...current, [field]: nextValue }));
    if (field === "line1") setIsOpen(true);
  };

  const choose = (suggestion: AddressSuggestion) => {
    setValue({
      city: suggestion.city,
      line1: suggestion.line1,
      postalCode: suggestion.postalCode,
    });
    setSuggestions([]);
    setIsOpen(false);
  };

  const fieldId = (field: string) => `${field}-${label}`;

  return (
    <div className="address-search-fields">
      <label htmlFor={fieldId("line1")}>Street and house number</label>
      <div className="address-search-control">
        <input
          id={fieldId("line1")}
          name="line1"
          value={value.line1}
          onChange={(event) => update("line1", event.target.value)}
          onFocus={() => value.line1.length >= 3 && setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 140)}
          placeholder="Start typing an address"
          autoComplete="street-address"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={resultsId}
          aria-expanded={isOpen && suggestions.length > 0}
          required
        />
        {isSearching ? (
          <span className="address-search-status">Searching</span>
        ) : null}
        {isOpen && suggestions.length > 0 ? (
          <div id={resultsId} className="address-search-results" role="listbox">
            {suggestions.map((suggestion) => (
              <button
                key={`${suggestion.line1}-${suggestion.postalCode}`}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion)}
              >
                <strong>{suggestion.line1}</strong>
                <span>
                  {suggestion.postalCode} {suggestion.city}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="address-search-hint">
        Start with a few letters; choose a result to fill the address.
      </p>

      <div className="address-search-grid">
        <label htmlFor={fieldId("postalCode")}>
          Postal code
          <input
            id={fieldId("postalCode")}
            name="postalCode"
            value={value.postalCode}
            onChange={(event) => update("postalCode", event.target.value)}
            placeholder="1015 CJ"
            autoComplete="postal-code"
            required
          />
        </label>
        <label htmlFor={fieldId("city")}>
          City
          <input
            id={fieldId("city")}
            name="city"
            value={value.city}
            onChange={(event) => update("city", event.target.value)}
            placeholder="Amsterdam"
            autoComplete="address-level2"
            required
          />
        </label>
      </div>
    </div>
  );
}
