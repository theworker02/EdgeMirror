import { describe, expect, it } from "vitest";
import {
  createMemoryOrganizationStore,
  createOrganization,
  linkStripeCustomer,
} from "./index.js";

describe("organizations", () => {
  it("creates org with owner member and community plan", () => {
    const store = createMemoryOrganizationStore();
    const org = createOrganization(store, {
      name: "Acme Labs",
      ownerUserId: "user_1",
    });
    expect(org.planId).toBe("community");
    expect(org.subscriptionStatus).toBe("none");
    expect(org.stripeCustomerId).toBeUndefined();
    expect(store.countMembers(org.id)).toBe(1);
    expect(store.listMembers(org.id)[0]?.role).toBe("owner");
  });

  it("links Stripe customer id only once", () => {
    const store = createMemoryOrganizationStore();
    const org = createOrganization(store, {
      name: "Beta",
      ownerUserId: "u1",
    });
    const linked = linkStripeCustomer(store, org.id, "cus_test_123");
    expect(linked.stripeCustomerId).toBe("cus_test_123");
    expect(store.getByStripeCustomerId("cus_test_123")?.id).toBe(org.id);
    expect(() => linkStripeCustomer(store, org.id, "cus_other")).toThrow(
      /STRIPE_CUSTOMER_ALREADY_LINKED/,
    );
  });
});
