/**
 * @file CrudButton.tsx
 * @description Permission-aware wrapper around `CustomButton`. Renders the
 *   button only when the active user has the required module:action grant.
 *   Optionally renders a disabled state with a tooltip instead of hiding —
 *   useful in table rows where layout shouldn't shift.
 *
 * @example
 *   <CrudButton
 *     module={Module.NOTICE}
 *     action={PermissionAction.CREATE}
 *     startIcon={<Plus className="h-4 w-4" />}
 *     onClick={openCreate}
 *   >
 *     New Notice
 *   </CrudButton>
 */
'use client';

import React from 'react';
import CustomButton from './CustomButton';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
type ButtonVariant = 'primary' | 'secondary' | 'cancel' | 'tertiary' | 'refresh';
type ButtonSize = 'small' | 'medium' | 'large' | 'sm';

interface ICrudButtonProps {
  module: string;
  action: string;
  /** When true, render a disabled button instead of hiding it. */
  showDisabled?: boolean;
  /** Tooltip / title attribute when the button is shown disabled. */
  noAccessHint?: string;
  children?: React.ReactNode;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
  disabled?: boolean;
  size?: ButtonSize;
  fullWidth?: boolean;
  loadingText?: string;
  variant?: ButtonVariant;
}

export default function CrudButton({
  module,
  action,
  showDisabled = false,
  noAccessHint = 'You do not have permission to perform this action.',
  disabled,
  ...rest
}: ICrudButtonProps) {
  const allowed = useHasPermission(module, action);
  if (!allowed && !showDisabled) return null;
  return (
    <span title={!allowed ? noAccessHint : undefined}>
      <CustomButton {...rest} disabled={disabled || !allowed} />
    </span>
  );
}
