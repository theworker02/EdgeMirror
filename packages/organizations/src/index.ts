/**
 * @edgemirror/organizations — org membership + Stripe customer IDs only (never card data).
 */

export type OrgRole = "owner" | "admin" | "member";

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unpaid"
  | "paused";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  /** Stripe Customer id (cus_…) — never store PANs / card numbers. */
  stripeCustomerId?: string;
  /** Stripe Subscription id (sub_…) */
  stripeSubscriptionId?: string;
  /** Stripe Price id currently billed (price_…) */
  stripePriceId?: string;
  /** Logical plan id from @edgemirror/billing plan catalog */
  planId: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  seatsUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  orgId: string;
  userId: string;
  role: OrgRole;
  joinedAt: string;
}

export interface OrganizationStore {
  get(orgId: string): Organization | undefined;
  getByStripeCustomerId(customerId: string): Organization | undefined;
  getByStripeSubscriptionId(subscriptionId: string): Organization | undefined;
  upsert(org: Organization): Organization;
  list(): Organization[];
  addMember(member: OrgMember): void;
  listMembers(orgId: string): OrgMember[];
  countMembers(orgId: string): number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "org";
}

export function createMemoryOrganizationStore(
  seed: Organization[] = [],
): OrganizationStore {
  const orgs = new Map<string, Organization>();
  const members = new Map<string, OrgMember[]>();

  for (const org of seed) {
    orgs.set(org.id, { ...org });
  }

  return {
    get(orgId) {
      return orgs.get(orgId);
    },

    getByStripeCustomerId(customerId) {
      for (const org of orgs.values()) {
        if (org.stripeCustomerId === customerId) return org;
      }
      return undefined;
    },

    getByStripeSubscriptionId(subscriptionId) {
      for (const org of orgs.values()) {
        if (org.stripeSubscriptionId === subscriptionId) return org;
      }
      return undefined;
    },

    upsert(org) {
      const next = { ...org, updatedAt: nowIso() };
      orgs.set(next.id, next);
      return next;
    },

    list() {
      return [...orgs.values()];
    },

    addMember(member) {
      const list = members.get(member.orgId) ?? [];
      if (!list.some((m) => m.userId === member.userId)) {
        list.push(member);
        members.set(member.orgId, list);
      }
      const org = orgs.get(member.orgId);
      if (org) {
        org.seatsUsed = list.length;
        org.updatedAt = nowIso();
        orgs.set(org.id, org);
      }
    },

    listMembers(orgId) {
      return [...(members.get(orgId) ?? [])];
    },

    countMembers(orgId) {
      return (members.get(orgId) ?? []).length;
    },
  };
}

export interface CreateOrgInput {
  id?: string;
  name: string;
  slug?: string;
  ownerUserId: string;
  planId?: string;
}

export function createOrganization(
  store: OrganizationStore,
  input: CreateOrgInput,
): Organization {
  const createdAt = nowIso();
  const org: Organization = {
    id: input.id ?? `org_${cryptoRandom(10)}`,
    name: input.name,
    slug: input.slug ?? slugify(input.name),
    planId: input.planId ?? "community",
    subscriptionStatus: "none",
    seatsUsed: 0,
    createdAt,
    updatedAt: createdAt,
  };
  store.upsert(org);
  store.addMember({
    orgId: org.id,
    userId: input.ownerUserId,
    role: "owner",
    joinedAt: createdAt,
  });
  return store.get(org.id)!;
}

function cryptoRandom(bytes: number): string {
  const arr = new Uint8Array(bytes);
  // Prefer Web Crypto when available (Node 20+)
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Buffer.from(arr).toString("hex");
}

export function linkStripeCustomer(
  store: OrganizationStore,
  orgId: string,
  stripeCustomerId: string,
): Organization {
  const org = store.get(orgId);
  if (!org) throw new Error(`ORG_NOT_FOUND:${orgId}`);
  if (org.stripeCustomerId && org.stripeCustomerId !== stripeCustomerId) {
    throw new Error("STRIPE_CUSTOMER_ALREADY_LINKED");
  }
  return store.upsert({ ...org, stripeCustomerId });
}
