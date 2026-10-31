import { env } from "@/config/env";
import { providerCurrency, providerRate, toProviderAmount } from "@/modules/payments/currency";

const mutableEnv = env as unknown as Record<string, unknown>;
const saved = {
  PAYMENT_CURRENCY: env.PAYMENT_CURRENCY,
  STRIPE_CURRENCY: env.STRIPE_CURRENCY,
  STRIPE_RATE: env.STRIPE_RATE,
  PAYPAL_CURRENCY: env.PAYPAL_CURRENCY,
  PAYPAL_RATE: env.PAYPAL_RATE,
};

afterAll(() => {
  Object.assign(mutableEnv, saved);
});

describe("Conversión de moneda por proveedor", () => {
  beforeEach(() => {
    mutableEnv.PAYMENT_CURRENCY = "GTQ";
    mutableEnv.STRIPE_CURRENCY = "MXN";
    mutableEnv.STRIPE_RATE = 0.42; // 0.42 GTQ por 1 MXN
    mutableEnv.PAYPAL_CURRENCY = "USD";
    mutableEnv.PAYPAL_RATE = 7.7; // 7.7 GTQ por 1 USD
  });

  it("convierte quetzales a la moneda de cada proveedor, con 2 decimales", () => {
    expect(toProviderAmount("STRIPE", 95)).toEqual({ value: 226.19, currency: "MXN" });
    expect(toProviderAmount("PAYPAL", 95)).toEqual({ value: 12.34, currency: "USD" });
  });

  it("si el proveedor cobra en la moneda de la tienda no convierte (tipo de cambio 1)", () => {
    mutableEnv.STRIPE_CURRENCY = undefined; // Stripe cobra en la moneda de la tienda
    expect(providerCurrency("STRIPE")).toBe("GTQ");
    expect(providerRate("STRIPE")).toBe(1);
    expect(toProviderAmount("STRIPE", 95)).toEqual({ value: 95, currency: "GTQ" });
  });

  it("si cobra en otra moneda y falta el tipo de cambio, falla con un error claro (503) en vez de cobrar mal", () => {
    mutableEnv.STRIPE_RATE = undefined;
    expect(() => toProviderAmount("STRIPE", 95)).toThrow(/falta el tipo de cambio/);
  });

  it("ida y vuelta: el monto cobrado equivale al de la orden dentro del redondeo", () => {
    const charged = toProviderAmount("STRIPE", 123.45);
    expect(Math.abs(charged.value * 0.42 - 123.45)).toBeLessThan(0.01);
  });
});
