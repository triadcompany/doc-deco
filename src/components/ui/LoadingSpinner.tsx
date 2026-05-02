import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

export const LoadingSpinner = ({ size = 24, className }: LoadingSpinnerProps) => {
  return <Loader2 style={{ width: size, height: size }} className={`animate-spin text-primary ${className}`} />;
};
