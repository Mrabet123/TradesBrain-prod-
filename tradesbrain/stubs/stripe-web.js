// Web stub for @stripe/stripe-react-native. The native SDK has no web build —
// for web payments use @stripe/stripe-js instead. This stub lets Metro bundle
// for web without crashing on native-only imports.
const noop = () => {};
const NoopComponent = () => null;

module.exports = {
  StripeProvider: NoopComponent,
  CardField: NoopComponent,
  CardForm: NoopComponent,
  PaymentSheet: NoopComponent,
  StripeContainer: NoopComponent,
  AddressSheet: NoopComponent,
  useStripe: () => ({}),
  useConfirmPayment: () => ({ confirmPayment: noop, loading: false }),
  usePaymentSheet: () => ({ initPaymentSheet: noop, presentPaymentSheet: noop, loading: false }),
  initStripe: noop,
  presentPaymentSheet: noop,
  confirmPayment: noop,
};
