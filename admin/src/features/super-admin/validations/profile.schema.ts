/**
 * @file profile.schema.ts
 * @description Validation rules for the SaaS operator password form.
 * @module features/super-admin/validations
 */

import * as Yup from 'yup';

export const operatorPasswordSchema = Yup.object({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string()
    .min(12, 'Use at least 12 characters')
    .matches(/[A-Z]/, 'Include an uppercase letter')
    .matches(/[a-z]/, 'Include a lowercase letter')
    .matches(/[0-9]/, 'Include a number')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Confirm the new password'),
});
