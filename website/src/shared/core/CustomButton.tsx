import { LoaderCircle, RefreshCcw } from 'lucide-react';

type TButtonVariant = 'primary' | 'secondary' | 'cancel' | 'tertiary' | 'refresh';
type TButtonSize = 'small' | 'medium' | 'large' | 'sm';

interface ICustomButtonProps {
  children?: React.ReactNode;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
  disabled?: boolean;
  size?: TButtonSize;
  fullWidth?: boolean;
  loadingText?: string;
  variant?: TButtonVariant;
}

const variantClasses: Record<TButtonVariant, string> = {
  primary: 'bg-[#0178d7] text-white hover:bg-[#0168bc]',
  secondary: 'bg-white text-[#354052] hover:bg-[#edf5fb]',
  cancel: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  tertiary: 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100',
  refresh: 'bg-[#0178d7] text-white hover:bg-[#0168bc]',
};

const sizeClasses: Record<TButtonSize, string> = {
  small: 'px-3 py-2 text-xs',
  sm: 'px-3 py-2 text-xs',
  medium: 'px-5 py-2.5 text-sm',
  large: 'px-6 py-3 text-base',
};

export default function CustomButton({
  children,
  startIcon,
  endIcon,
  className = '',
  onClick,
  type = 'button',
  loading = false,
  disabled = false,
  size = 'medium',
  fullWidth = true,
  loadingText = 'Loading...',
  variant = 'primary',
}: ICustomButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : 'w-auto'} ${className}`}
    >
      {loading ? (
        <LoaderCircle size={17} className="animate-spin" />
      ) : variant === 'refresh' ? (
        <RefreshCcw size={17} />
      ) : (
        startIcon
      )}
      {loading ? loadingText : children}
      {!loading && endIcon}
    </button>
  );
}
