"use client";

import type { RetailerBranch } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useState } from "react";

interface OpeningHoursRow {
  day:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";
  closed: boolean;
  opens?: string;
  closes?: string;
}

interface ContactActionRow {
  type: "call" | "email" | "book" | "directions";
  label: string;
  value: string;
}

interface ImageryRow {
  url: string;
  alt: string;
  rightsNote?: string;
}

export function LocationDetailsForm({
  branchId,
  branch,
  action,
}: {
  branchId: string;
  branch: RetailerBranch;
  action: (branchId: string, formData: FormData) => Promise<void>;
}) {
  const [storeType, setStoreType] = useState(branch.storeType || "");
  const [addressLine1, setAddressLine1] = useState(branch.addressLine1 || "");
  const [addressLine2, setAddressLine2] = useState(branch.addressLine2 || "");
  const [city, setCity] = useState(branch.city || "");
  const [region, setRegion] = useState(branch.region || "");
  const [postalCode, setPostalCode] = useState(branch.postalCode || "");
  const [country, setCountry] = useState(branch.country || "");
  const [latitude, setLatitude] = useState(branch.latitude?.toString() || "");
  const [longitude, setLongitude] = useState(
    branch.longitude?.toString() || "",
  );
  const [phone, setPhone] = useState(branch.phone || "");
  const [contactEmail, setContactEmail] = useState(branch.contactEmail || "");
  const [presentationMode, setPresentationMode] = useState<"map" | "globe">(
    branch.presentationMode,
  );
  const [published, setPublished] = useState(branch.published);

  const [openingHours, setOpeningHours] = useState<OpeningHoursRow[]>(
    branch.openingHours.length > 0
      ? (branch.openingHours as OpeningHoursRow[])
      : [
          { day: "monday", closed: false, opens: "09:00", closes: "17:00" },
          { day: "tuesday", closed: false, opens: "09:00", closes: "17:00" },
          { day: "wednesday", closed: false, opens: "09:00", closes: "17:00" },
          { day: "thursday", closed: false, opens: "09:00", closes: "17:00" },
          { day: "friday", closed: false, opens: "09:00", closes: "17:00" },
          { day: "saturday", closed: true },
          { day: "sunday", closed: true },
        ],
  );

  const [contactActions, setContactActions] = useState<ContactActionRow[]>(
    branch.contactActions as ContactActionRow[],
  );

  const [imagery, setImagery] = useState<ImageryRow[]>(
    branch.imagery as ImageryRow[],
  );

  const [filterCategories, setFilterCategories] = useState(
    branch.filterCategories.join(", "),
  );

  const [services, setServices] = useState(branch.services.join(", "));

  function updateOpeningHours(index: number, patch: Partial<OpeningHoursRow>) {
    setOpeningHours((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function updateContactAction(
    index: number,
    patch: Partial<ContactActionRow>,
  ) {
    setContactActions((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addContactAction() {
    setContactActions((current) => [
      ...current,
      { type: "call", label: "", value: "" },
    ]);
  }

  function removeContactAction(index: number) {
    setContactActions((current) => current.filter((_, i) => i !== index));
  }

  function updateImagery(index: number, patch: Partial<ImageryRow>) {
    setImagery((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addImagery() {
    setImagery((current) => [...current, { url: "", alt: "", rightsNote: "" }]);
  }

  function removeImagery(index: number) {
    setImagery((current) => current.filter((_, i) => i !== index));
  }

  const validContactActions = contactActions.filter(
    (row) => row.label.trim() && row.value.trim(),
  );

  const validImagery = imagery.filter(
    (row) => row.url.trim() && row.alt.trim(),
  );

  const handleSubmit = async (formData: FormData) => {
    formData.set("branchId", branchId);
    formData.set("openingHours", JSON.stringify(openingHours));
    formData.set("contactActions", JSON.stringify(validContactActions));
    formData.set("imagery", JSON.stringify(validImagery));
    await action(branchId, formData);
  };

  return (
    <form
      className="flex flex-col gap-8"
      action={async (formData) => handleSubmit(formData)}
    >
      <input type="hidden" name="branchId" value={branchId} />
      <input
        type="hidden"
        name="openingHours"
        value={JSON.stringify(openingHours)}
      />
      <input
        type="hidden"
        name="contactActions"
        value={JSON.stringify(validContactActions)}
      />
      <input
        type="hidden"
        name="imagery"
        value={JSON.stringify(validImagery)}
      />

      {/* Basic Information */}
      <Card className="flex flex-col gap-4">
        <h2 className="font-medium text-[var(--color-stone-900)]">
          Location Details
        </h2>

        <FormField label="Store Type" htmlFor="storeType">
          <Input
            id="storeType"
            name="storeType"
            placeholder="e.g. Flagship Store, Boutique"
            maxLength={80}
            value={storeType}
            onChange={(e) => setStoreType(e.target.value)}
          />
        </FormField>

        <FormField label="Address Line 1" htmlFor="addressLine1">
          <Input
            id="addressLine1"
            name="addressLine1"
            placeholder="Street address"
            maxLength={200}
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
          />
        </FormField>

        <FormField label="Address Line 2" htmlFor="addressLine2">
          <Input
            id="addressLine2"
            name="addressLine2"
            placeholder="Apartment, suite, etc."
            maxLength={200}
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="City" htmlFor="city">
            <Input
              id="city"
              name="city"
              maxLength={120}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </FormField>

          <FormField label="Region / State" htmlFor="region">
            <Input
              id="region"
              name="region"
              maxLength={120}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </FormField>

          <FormField label="Postal Code" htmlFor="postalCode">
            <Input
              id="postalCode"
              name="postalCode"
              maxLength={32}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </FormField>

          <FormField label="Country" htmlFor="country">
            <Input
              id="country"
              name="country"
              maxLength={120}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Latitude" htmlFor="latitude">
            <Input
              id="latitude"
              name="latitude"
              type="number"
              min="-90"
              max="90"
              step="0.0001"
              placeholder="-90 to 90"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
          </FormField>

          <FormField label="Longitude" htmlFor="longitude">
            <Input
              id="longitude"
              name="longitude"
              type="number"
              min="-180"
              max="180"
              step="0.0001"
              placeholder="-180 to 180"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Phone" htmlFor="phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            maxLength={40}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </FormField>

        <FormField label="Contact Email" htmlFor="contactEmail">
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            maxLength={200}
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </FormField>
      </Card>

      {/* Opening Hours */}
      <Card className="flex flex-col gap-4">
        <h2 className="font-medium text-[var(--color-stone-900)]">
          Opening Hours
        </h2>

        <div className="space-y-3">
          {openingHours.map((row, index) => (
            <div
              key={row.day}
              className="border-b border-[var(--color-stone-100)] pb-3 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <label className="flex flex-1 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.closed}
                    onChange={(e) =>
                      updateOpeningHours(index, { closed: e.target.checked })
                    }
                  />
                  <span className="capitalize">{row.day}</span>
                </label>
                {!row.closed && (
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={row.opens || ""}
                      onChange={(e) =>
                        updateOpeningHours(index, { opens: e.target.value })
                      }
                      className="w-24"
                    />
                    <span className="text-sm">–</span>
                    <Input
                      type="time"
                      value={row.closes || ""}
                      onChange={(e) =>
                        updateOpeningHours(index, { closes: e.target.value })
                      }
                      className="w-24"
                    />
                  </div>
                )}
                {row.closed && (
                  <span className="text-sm text-[var(--color-stone-500)]">
                    Closed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Services */}
      <Card className="flex flex-col gap-4">
        <h2 className="font-medium text-[var(--color-stone-900)]">Services</h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Comma-separated list of services offered at this location
        </p>
        <FormField label="Services" htmlFor="services">
          <textarea
            id="services"
            name="services"
            placeholder="e.g. Tailoring, Alterations, Gift Wrapping"
            rows={3}
            value={services}
            onChange={(e) => setServices(e.target.value)}
            className="rounded border border-[var(--color-stone-200)] px-3 py-2 font-mono text-sm"
          />
        </FormField>
      </Card>

      {/* Contact Actions */}
      <Card className="flex flex-col gap-4">
        <h2 className="font-medium text-[var(--color-stone-900)]">
          Contact Actions
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          How customers can interact with this location
        </p>

        {contactActions.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-400)]">
            No contact actions yet.
          </p>
        ) : (
          <div className="space-y-3">
            {contactActions.map((row, index) => (
              <div
                key={index}
                className="border-b border-[var(--color-stone-100)] pb-3 last:border-b-0"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
                  <div className="flex-shrink-0 sm:flex-1">
                    <FormField label="Type" htmlFor={`action-type-${index}`}>
                      <Select
                        id={`action-type-${index}`}
                        value={row.type}
                        onChange={(e) =>
                          updateContactAction(index, {
                            type: e.target.value as ContactActionRow["type"],
                          })
                        }
                      >
                        <option value="call">Call</option>
                        <option value="email">Email</option>
                        <option value="book">Book</option>
                        <option value="directions">Directions</option>
                      </Select>
                    </FormField>
                  </div>

                  <div className="flex-1">
                    <FormField label="Label" htmlFor={`action-label-${index}`}>
                      <Input
                        id={`action-label-${index}`}
                        placeholder="e.g. Call us"
                        maxLength={80}
                        value={row.label}
                        onChange={(e) =>
                          updateContactAction(index, { label: e.target.value })
                        }
                      />
                    </FormField>
                  </div>

                  <div className="flex-1">
                    <FormField label="Value" htmlFor={`action-value-${index}`}>
                      <Input
                        id={`action-value-${index}`}
                        placeholder={
                          row.type === "call"
                            ? "+1-555-0000"
                            : row.type === "email"
                              ? "hello@example.com"
                              : row.type === "book"
                                ? "https://booking.example.com"
                                : "https://maps.example.com"
                        }
                        maxLength={300}
                        value={row.value}
                        onChange={(e) =>
                          updateContactAction(index, { value: e.target.value })
                        }
                      />
                    </FormField>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeContactAction(index)}
                    className="text-xs text-[var(--color-stone-500)] underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button type="button" variant="secondary" onClick={addContactAction}>
          Add contact action
        </Button>
      </Card>

      {/* Filter Categories */}
      <Card className="flex flex-col gap-4">
        <h2 className="font-medium text-[var(--color-stone-900)]">
          Filter Categories
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Comma-separated list of categories for filtering
        </p>
        <FormField label="Categories" htmlFor="filterCategories">
          <textarea
            id="filterCategories"
            name="filterCategories"
            placeholder="e.g. Premium, Luxury, Boutique"
            rows={2}
            value={filterCategories}
            onChange={(e) => setFilterCategories(e.target.value)}
            className="rounded border border-[var(--color-stone-200)] px-3 py-2 font-mono text-sm"
          />
        </FormField>
      </Card>

      {/* Imagery */}
      <Card className="flex flex-col gap-4">
        <h2 className="font-medium text-[var(--color-stone-900)]">
          Branch Images
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Photos or visual representations of this location
        </p>

        {imagery.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-400)]">
            No images yet.
          </p>
        ) : (
          <div className="space-y-3">
            {imagery.map((row, index) => (
              <div
                key={index}
                className="border-b border-[var(--color-stone-100)] pb-3 last:border-b-0"
              >
                <div className="flex flex-col gap-3">
                  <FormField label="Image URL" htmlFor={`img-url-${index}`}>
                    <Input
                      id={`img-url-${index}`}
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      maxLength={1000}
                      value={row.url}
                      onChange={(e) =>
                        updateImagery(index, { url: e.target.value })
                      }
                    />
                  </FormField>

                  <FormField label="Alt Text" htmlFor={`img-alt-${index}`}>
                    <Input
                      id={`img-alt-${index}`}
                      placeholder="Describe the image"
                      maxLength={200}
                      value={row.alt}
                      onChange={(e) =>
                        updateImagery(index, { alt: e.target.value })
                      }
                    />
                  </FormField>

                  <FormField
                    label="Rights Note (optional)"
                    htmlFor={`img-rights-${index}`}
                  >
                    <Input
                      id={`img-rights-${index}`}
                      placeholder="e.g. Photo by John Doe"
                      maxLength={500}
                      value={row.rightsNote || ""}
                      onChange={(e) =>
                        updateImagery(index, { rightsNote: e.target.value })
                      }
                    />
                  </FormField>

                  <button
                    type="button"
                    onClick={() => removeImagery(index)}
                    className="text-xs text-[var(--color-stone-500)] underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button type="button" variant="secondary" onClick={addImagery}>
          Add image
        </Button>
      </Card>

      {/* Presentation & Publishing */}
      <Card className="flex flex-col gap-4">
        <h2 className="font-medium text-[var(--color-stone-900)]">
          Presentation & Publishing
        </h2>

        <FormField label="Presentation Mode" htmlFor="presentationMode">
          <Select
            id="presentationMode"
            name="presentationMode"
            value={presentationMode}
            onChange={(e) =>
              setPresentationMode(e.target.value as "map" | "globe")
            }
          >
            <option value="map">2D Map</option>
            <option value="globe">Globe</option>
          </Select>
        </FormField>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <span className="text-sm font-medium text-[var(--color-stone-900)]">
            Published
          </span>
        </label>
        <p className="text-xs text-[var(--color-stone-500)]">
          Only published branches are visible to customers in the public
          location finder.
        </p>
      </Card>

      <Button type="submit" className="self-start">
        Save location details
      </Button>
    </form>
  );
}
