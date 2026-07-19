import {
  asId,
  type Collection,
  type CollectionId,
  type RetailerId,
} from "@paon/domain";
import type { PostgrestError } from "@supabase/supabase-js";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type CollectionRow = Database["public"]["Tables"]["collections"]["Row"];

const UNIQUE_VIOLATION = "23505";

export class CollectionSlugAlreadyExistsError extends Error {
  constructor(public readonly slug: string) {
    super(`A collection with slug "${slug}" already exists.`);
    this.name = "CollectionSlugAlreadyExistsError";
  }
}

function isUniqueViolation(error: PostgrestError): boolean {
  return error.code === UNIQUE_VIOLATION;
}

function toDomain(row: CollectionRow): Collection {
  return {
    id: asId<"CollectionId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    name: row.name,
    slug: row.slug,
    ...(row.season ? { season: row.season } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateCollectionParams {
  retailerId: RetailerId;
  name: string;
  slug: string;
  season?: string;
}

export class CollectionRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: CollectionId): Promise<Collection | null> {
    const { data, error } = await this.client
      .from("collections")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
  }

  async findByRetailer(retailerId: RetailerId): Promise<Collection[]> {
    const { data, error } = await this.client
      .from("collections")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async create(params: CreateCollectionParams): Promise<Collection> {
    const { data, error } = await this.client
      .from("collections")
      .insert({
        retailer_id: params.retailerId,
        name: params.name,
        slug: params.slug,
        season: params.season ?? null,
      })
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        throw new CollectionSlugAlreadyExistsError(params.slug);
      }
      throw error;
    }

    return toDomain(data);
  }
}
