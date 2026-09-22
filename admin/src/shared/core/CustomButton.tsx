import { CircularProgress, Button as MuiButton } from '@mui/material';
import { RefreshCcw } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'cancel' | 'tertiary' | 'refresh';
type ButtonSize = 'small' | 'medium' | 'large' | 'sm';

type Props = {
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
};

const CustomButton = ({
  children,
  startIcon,
  endIcon,
  className = 'w-fit!',
  onClick,
  type = 'button',
  loading,
  disabled,
  size = 'medium',
  fullWidth = true,
  loadingText = 'Loading...',
  variant = 'primary',
}: Props) => {
  // Variant styles lookup object
  const variantStyles: Record<ButtonVariant, Record<string, unknown>> = {
    primary: {
      backgroundImage: 'linear-gradient(135deg, #014B89 0%, #0178D7 55%, #3393DF 100%)',
      backgroundColor: 'transparent',
      color: 'white',
      border: 'none',
      boxShadow: 'rgba(1, 120, 215, 0.35) 0px 5px 15px',
      '&:hover': {
        backgroundImage: 'linear-gradient(135deg, #013d70 0%, #0166bb 55%, #2480cc 100%)',
        backgroundColor: 'transparent',
        boxShadow: 'rgba(1, 120, 215, 0.5) 0px 8px 20px',
      },
      '&.Mui-disabled': {
        backgroundImage: 'none',
        backgroundColor: '#525252',
        opacity: 0.7,
        color: 'white',
        boxShadow: 'none',
      },
    },
    secondary: {
      background: 'transparent',
      color: '#6160b0',
      border: '1px solid #6160b0',
      boxShadow: 'none',
      '&:hover': {
        background: 'rgba(97, 96, 176, 0.08)',
        border: '1.5px solid #6160b0',
        boxShadow: 'none',
      },
      '&.Mui-disabled': {
        background: 'transparent',
        opacity: 0.5,
        color: '#6160b0',
        border: '1.5px solid #6160b0',
        boxShadow: 'none',
      },
    },
    cancel: {
      background: 'transparent',
      color: '#dc2626',
      border: '1.5px solid #fca5a5',
      boxShadow: 'none',
      '&:hover': {
        background: 'rgba(252, 165, 165, 0.1)',
        border: '1.5px solid #fca5a5',
        boxShadow: 'none',
      },
      '&.Mui-disabled': {
        background: 'transparent',
        opacity: 0.5,
        color: '#dc2626',
        border: '1.5px solid #fca5a5',
        boxShadow: 'none',
      },
    },
    tertiary: {
      background: 'transparent',
      color: '#74c9d5',
      border: '1.5px solid #74c9d5',
      boxShadow: 'none',
      '&:hover': {
        background: 'rgba(116, 201, 213, 0.08)',
        border: '1.5px solid #74c9d5',
        boxShadow: 'none',
      },
      '&.Mui-disabled': {
        background: 'transparent',
        opacity: 0.5,
        color: '#74c9d5',
        border: '1.5px solid #74c9d5',
        boxShadow: 'none',
      },
    },
    refresh: {
      background: 'transparent',
      color: '#6160b0',
      border: '1px solid #6160b0',
      boxShadow: 'none',
      borderRadius: '1rem',
      '&:hover': {
        background: 'rgba(97, 96, 176, 0.08)',
        border: '1px solid #6160b0',
        boxShadow: 'none',
      },
      '&.Mui-disabled': {
        background: 'transparent',
        opacity: 0.5,
        color: '#6160b0',
        border: '1.5px solid #6160b0',
        boxShadow: 'none',
      },
    },
  };

  // Font size lookup object
  const fontSizes: Record<ButtonSize, string> = {
    sm: '0.7rem',
    small: '0.75rem',
    medium: '0.875rem',
    large: '1rem',
  };

  // Determine the start icon
  const getStartIcon = () => {
    if (loading) {
      if (variant === 'refresh') {
        return (
          <RefreshCcw
            size={16}
            className="animate-spin"
            style={{ animation: 'spin 1s linear infinite' }}
          />
        );
      }
      return undefined;
    }
    if (variant === 'refresh' && !startIcon) {
      return <RefreshCcw size={16} />;
    }
    return startIcon;
  };

  return (
    <MuiButton
      className={className + ' tracking-widest! transition-all! duration-300! ease-in-out!'}
      onClick={onClick}
      type={type}
      disabled={Boolean(disabled || loading)}
      size={size === 'sm' ? 'small' : size}
      fullWidth={fullWidth}
      startIcon={getStartIcon()}
      endIcon={loading && variant !== 'refresh' ? undefined : endIcon}
      sx={{
        ...variantStyles[variant],
        textTransform: 'capitalize',
        fontSize: fontSizes[size],
        padding: '0.4rem 0.8rem',
        borderRadius: '0.3rem',
        fontWeight: 500,
        transition: 'all 0.3s ease-in-out',
        '@media (prefers-color-scheme: dark)': {
          backgroundImage:
            variant === 'primary'
              ? 'linear-gradient(135deg, #014B89 0%, #0178D7 55%, #3393DF 100%)'
              : undefined,
          backgroundColor: variant === 'primary' ? 'transparent' : 'transparent',
        },
      }}
    >
      {loading && variant !== 'refresh' ? (
        <span
          className="font-satoshi"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <CircularProgress size={20} color="inherit" />
          {loadingText}
        </span>
      ) : (
        children
      )}
    </MuiButton>
  );
};

export default CustomButton;
