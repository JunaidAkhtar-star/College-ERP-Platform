/**
 * @file auth.schema.ts
 * @description Yup validation schemas for all auth forms.
 *  - signinSchema        — email + password + optional role
 *  - forgotPasswordSchema — email only
 *  - resetPasswordSchema  — email + 6-digit OTP + new password (mirrors backend rules)
 * @module features/auth/validations
 */

import * as Yup from 'yup';
import { TSystemRole } from '@/shared/types';

// ── Signin ────────────────────────────────────────────────────────────────────
export const signinSchema = Yup.object({
  email: Yup.string().email('Enter a valid email address').required('Email is required'),
  password: Yup.string().required('Password is required'),
  role: Yup.string<TSystemRole>().optional(),
});

export type TSigninValues = Yup.InferType<typeof signinSchema>;

// ── Forgot Password ───────────────────────────────────────────────────────────
export const forgotPasswordSchema = Yup.object({
  email: Yup.string().email('Enter a valid email address').required('Email is required'),
});

export type TForgotPasswordValues = Yup.InferType<typeof forgotPasswordSchema>;

// ── Reset Password ────────────────────────────────────────────────────────────
export const resetPasswordSchema = Yup.object({
  email: Yup.string().email('Enter a valid email address').required('Email is required'),
  otp: Yup.string()
    .matches(/^\d{6}$/, 'OTP must be exactly 6 digits')
    .required('OTP is required'),
  newPassword: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Must contain at least one number')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords do not match')
    .required('Please confirm your password'),
});

export type TResetPasswordValues = Yup.InferType<typeof resetPasswordSchema>;
