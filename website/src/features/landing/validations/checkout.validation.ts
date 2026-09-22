import * as Yup from 'yup';

const PAYMENT_PROOF_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_PAYMENT_PROOF_BYTES = 5 * 1024 * 1024;

export const paymentConfirmationSchema = Yup.object({
  transferReference: Yup.string()
    .trim()
    .uppercase()
    .matches(
      /^[A-Z0-9][A-Z0-9-]{7,49}$/,
      'Enter an 8–50 character reference starting with a letter or number.',
    )
    .required('Bank transaction reference is required.'),
  paymentDate: Yup.string()
    .required('Payment date is required.')
    .test('valid-payment-date', 'Select a payment date within the last 45 days.', (value) => {
      if (!value) return false;
      const selected = new Date(`${value}T00:00:00`);
      const now = new Date();
      const oldest = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
      return !Number.isNaN(selected.getTime()) && selected <= now && selected >= oldest;
    }),
  paymentChannel: Yup.string()
    .oneOf(['neft', 'rtgs', 'imps', 'upi'], 'Select a supported payment method.')
    .required('Payment method is required.'),
  proof: Yup.mixed<File>()
    .required('Payment receipt or screenshot is required.')
    .test('proof-size', 'Payment proof must be 5 MB or smaller.', (file) =>
      file ? file.size <= MAX_PAYMENT_PROOF_BYTES : false,
    )
    .test('proof-type', 'Upload a PDF, PNG, JPG or WEBP payment proof.', (file) =>
      file ? PAYMENT_PROOF_TYPES.includes(file.type) : false,
    ),
});
