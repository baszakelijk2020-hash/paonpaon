import type { RetailerId } from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

/** Lighter than `Customer` — a browser who signed up for emails but
 * hasn't started a purchase relationship. See `subscribe_to_newsletter`. */
export interface NewsletterSubscriber extends Timestamps {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly email: string;
  readonly subscribedAt: string;
  readonly unsubscribedAt?: string;
}
